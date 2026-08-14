import base64

import edge_tts
from asgiref.sync import async_to_sync


async def generate_speech_async(text: str, voice: str) -> bytes:
    communicate = edge_tts.Communicate(text, voice)
    audio_bytes = bytearray()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_bytes.extend(chunk["data"])
    return bytes(audio_bytes)


def generate_speech(text: str, voice: str = "en-US-AriaNeural") -> str:
    raw_audio = async_to_sync(generate_speech_async)(text, voice)
    audio_base64 = base64.b64encode(raw_audio).decode("utf-8")
    return f"data:audio/mp3;base64,{audio_base64}"
