// Original volcani orb shaders, preserved byte-for-byte. Animation is driven by uniforms.
export const VERTEX_SHADER = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;
export const FRAGMENT_SHADER = `
  precision mediump float;
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_audio;
  uniform vec2 u_mouse;
  uniform int u_theme;
  uniform int u_state;
  uniform float u_shockwave;
  uniform float u_voice_sync;
  uniform float u_word_vibe;

  // Simplex Noise 3D
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
               i.z + vec4(0.0, i1.z, i2.z, 1.0))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0))
             + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3  ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  void getPalette(int theme, out vec3 c1, out vec3 c2, out vec3 c3, out vec3 c4, out vec3 cCore) {
    if (theme == 0) {
      c1 = vec3(0.0, 0.94, 1.0);
      c2 = vec3(1.0, 0.0, 0.5);
      c3 = vec3(0.47, 0.16, 0.85);
      c4 = vec3(1.0, 0.67, 0.1);
      cCore = vec3(1.0, 0.98, 0.95);
    } else if (theme == 1) {
      c1 = vec3(0.0, 0.49, 0.94);
      c2 = vec3(0.0, 0.87, 0.85);
      c3 = vec3(1.0, 0.0, 0.5);
      c4 = vec3(0.35, 0.0, 0.8);
      cCore = vec3(0.9, 0.95, 1.0);
    } else if (theme == 2) {
      c1 = vec3(0.18, 0.77, 0.35);
      c2 = vec3(0.0, 0.9, 0.95);
      c3 = vec3(0.1, 0.5, 0.95);
      c4 = vec3(0.95, 0.8, 0.2);
      cCore = vec3(0.95, 1.0, 0.95);
    } else if (theme == 3) {
      c1 = vec3(1.0, 0.0, 0.35);
      c2 = vec3(0.0, 1.0, 0.8);
      c3 = vec3(0.65, 0.0, 1.0);
      c4 = vec3(1.0, 0.9, 0.0);
      cCore = vec3(1.0, 1.0, 1.0);
    } else {
      c1 = vec3(0.65, 0.3, 0.98);
      c2 = vec3(1.0, 0.3, 0.0);
      c3 = vec3(0.1, 0.7, 0.95);
      c4 = vec3(0.98, 0.15, 0.55);
      cCore = vec3(1.0, 0.95, 0.9);
    }
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
    float dist = length(uv);

    vec3 c1, c2, c3, c4, cCore;
    getPalette(u_theme, c1, c2, c3, c4, cCore);

    float baseR = 0.36;
    float audioPulse = u_audio * 0.05;
    float shock = u_shockwave * 0.032 * sin(dist * 38.0 - u_time * 9.0);
    float R = baseR + audioPulse + shock;

    float speed = 0.65;
    float turb = 1.0;
    if (u_state == 1) { speed = 1.1; turb = 1.4 + u_audio * 1.6; }
    else if (u_state == 2) { speed = 2.4; turb = 2.2; }
    else if (u_state == 3) { speed = 1.45; turb = 1.6 + u_voice_sync * 1.9; }

    float corona = exp(-max(dist - R, 0.0) * 11.5);
    vec3 coronaColor = mix(c1, c2, 0.5 + 0.5 * sin(u_time * 0.85)) * corona * (0.55 + u_audio * 0.65 + u_voice_sync * 0.75);

    if (dist > R + 0.075) {
      float outerGlow = exp(-(dist - R) * 15.0) * 0.45;
      gl_FragColor = vec4(coronaColor * outerGlow, outerGlow * (0.6 + u_audio * 0.4 + u_voice_sync * 0.5));
      return;
    }

    float z = sqrt(max(R * R - dist * dist, 0.0));
    vec3 norm = normalize(vec3(uv, z));
    vec3 lightDir = normalize(vec3(u_mouse.x * 0.8, -u_mouse.y * 0.8, 1.25));

    float t = u_time * speed;
    vec3 p = norm;
    float angleY = t * 0.35 + u_mouse.x * 0.55;
    float cy = cos(angleY); float sy = sin(angleY);
    p.xz = mat2(cy, -sy, sy, cy) * p.xz;

    float angleX = t * 0.22;
    float cx = cos(angleX); float sx = sin(angleX);
    p.yz = mat2(cx, -sx, sx, cx) * p.yz;

    float n1 = snoise(p * 2.15 * turb + vec3(0.0, 0.0, t * 0.4));
    float n2 = snoise(p * 3.45 * turb - vec3(0.0, t * 0.55, 0.0));
    float n3 = snoise(p * 4.9 * turb + vec3(t * 0.5, 0.0, t * 0.35));

    float plasma1 = 0.5 + 0.5 * sin(n1 * 3.1415 + t);
    float plasma2 = 0.5 + 0.5 * cos(n2 * 3.1415 - t * 1.25);
    float plasma3 = 0.5 + 0.5 * sin(n3 * 4.0 + n1 * 2.2);

    vec3 col = mix(c1, c2, plasma1);
    col = mix(col, c3, plasma2 * 0.88);
    col = mix(col, c4, plasma3 * 0.65);

    if (u_state == 3) {
      float speechWave1 = sin(norm.y * 24.0 - u_time * 16.0);
      float speechWave2 = cos(norm.x * 20.0 + u_time * 12.0);
      float acousticMod = (speechWave1 * speechWave2) * u_voice_sync;
      float wordVibeShudder = sin(dist * 60.0 - u_time * 30.0) * u_word_vibe;
      R += acousticMod * 0.032 + u_voice_sync * 0.024 + wordVibeShudder * 0.045;
      float acousticRings = sin(length(uv) * 44.0 - u_time * 18.0);
      float ringGlow = max(0.0, acousticRings) * u_voice_sync;
      col += mix(c1, c2, 0.5 + 0.5 * acousticRings) * ringGlow * 0.95;
      col += vec3(0.9, 0.95, 1.0) * (u_word_vibe * 0.4);
      col += cCore * (u_voice_sync * 0.45 * pow(norm.z, 1.8));
    }

    float coreIntensity = pow(norm.z, 2.3) * (0.55 + 0.45 * plasma1) * (0.85 + u_audio * 0.75);
    col = mix(col, cCore, coreIntensity * 0.65);

    float fresnel = pow(1.0 - norm.z, 2.5);
    vec3 rimColor = mix(c1, c2, 0.5 + 0.5 * cos(u_time + norm.x * 3.0));
    col += rimColor * fresnel * 1.85;

    vec3 halfV = normalize(lightDir + vec3(0.0, 0.0, 1.0));
    float spec1 = pow(max(dot(norm, halfV), 0.0), 38.0);
    float spec2 = pow(max(dot(norm, normalize(vec3(-0.6, 0.7, 0.8))), 0.0), 22.0) * 0.4;
    col += vec3(1.0) * (spec1 * 0.95 + spec2 * 0.5);

    float edgeAlpha = smoothstep(R + 0.006, R - 0.006, dist);
    vec3 finalColor = mix(coronaColor, col, edgeAlpha);
    float finalAlpha = max(edgeAlpha, corona * (0.6 + u_audio * 0.5 + u_voice_sync * 0.5));

    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;
