/**
 * Low-latency audio capture pipeline.
 * Captures microphone input, computes audio energy levels,
 * resamples to 16kHz 16-bit PCM for local speech recognition,
 * and maintains a rolling audio buffer so sentence onsets are never clipped.
 */

export interface AudioCaptureCallbacks {
  onAudioLevel?: (level: number) => void;
  onPcmData?: (pcm: Int16Array) => void;
  onError?: (error: Error) => void;
}

export class AudioCapture {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private callbacks: AudioCaptureCallbacks;
  private isCapturing = false;
  private targetDeviceId: string | null = null;

  // Rolling buffer: retains ~250ms of 16kHz audio (4000 samples)
  private readonly rollingBufferSize = 4000;
  private rollingBuffer: Int16Array = new Int16Array(this.rollingBufferSize);
  private rollingBufferOffset = 0;

  constructor(callbacks: AudioCaptureCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public setCallbacks(callbacks: AudioCaptureCallbacks) {
    this.callbacks = callbacks;
  }

  public setDeviceId(deviceId: string | null) {
    this.targetDeviceId = deviceId;
  }

  public async start(): Promise<void> {
    if (this.isCapturing) return;

    if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
      throw new Error("Microphone capture is not supported in this environment.");
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          ...(this.targetDeviceId ? { deviceId: { exact: this.targetDeviceId } } : {}),
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.mediaStream = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) throw new Error("AudioContext is not available.");

      const ctx = new AudioCtx();
      this.audioContext = ctx;

      const source = ctx.createMediaStreamSource(stream);
      this.sourceNode = source;

      // Analyser for metering
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      this.analyserNode = analyser;

      // ScriptProcessor / Audio Processing node for 16kHz PCM downsampling
      const bufferSize = 2048;
      const processor = ctx.createScriptProcessor(bufferSize, 1, 1);
      this.processorNode = processor;

      const inputSampleRate = ctx.sampleRate;
      const targetSampleRate = 16000;
      const resampleRatio = targetSampleRate / inputSampleRate;

      processor.onaudioprocess = (event: AudioProcessingEvent) => {
        if (!this.isCapturing) return;

        const inputData = event.inputBuffer.getChannelData(0);

        // 1. Calculate RMS energy for meter
        let sumSquares = 0;
        for (let i = 0; i < inputData.length; i++) {
          const sample = inputData[i];
          sumSquares += sample * sample;
        }
        const rms = Math.sqrt(sumSquares / inputData.length);
        const normalizedLevel = Math.min(1, Math.max(0, (rms - 0.005) * 6));
        this.callbacks.onAudioLevel?.(normalizedLevel);

        // 2. Resample to 16kHz 16-bit PCM
        const outLength = Math.round(inputData.length * resampleRatio);
        const pcm16 = new Int16Array(outLength);

        for (let i = 0; i < outLength; i++) {
          const srcIdx = Math.min(inputData.length - 1, Math.floor(i / resampleRatio));
          const sample = Math.max(-1, Math.min(1, inputData[srcIdx]));
          pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        }

        // 3. Update rolling buffer
        for (let i = 0; i < pcm16.length; i++) {
          this.rollingBuffer[this.rollingBufferOffset] = pcm16[i];
          this.rollingBufferOffset = (this.rollingBufferOffset + 1) % this.rollingBufferSize;
        }

        // 4. Emit PCM data to listener
        this.callbacks.onPcmData?.(pcm16);
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      this.isCapturing = true;
    } catch (err) {
      this.stop();
      const error = err instanceof Error ? err : new Error(String(err));
      this.callbacks.onError?.(error);
      throw error;
    }
  }

  public getPreRollBuffer(): Int16Array {
    // Returns unrolled copy of the last ~250ms of audio
    const result = new Int16Array(this.rollingBufferSize);
    const start = this.rollingBufferOffset;
    let idx = 0;
    for (let i = start; i < this.rollingBufferSize; i++) {
      result[idx++] = this.rollingBuffer[i];
    }
    for (let i = 0; i < start; i++) {
      result[idx++] = this.rollingBuffer[i];
    }
    return result;
  }

  public stop(): void {
    this.isCapturing = false;

    if (this.processorNode) {
      try {
        this.processorNode.disconnect();
      } catch {}
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }

    if (this.analyserNode) {
      try {
        this.analyserNode.disconnect();
      } catch {}
      this.analyserNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== "closed") {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }

    this.callbacks.onAudioLevel?.(0);
  }

  public getIsCapturing(): boolean {
    return this.isCapturing;
  }
}
