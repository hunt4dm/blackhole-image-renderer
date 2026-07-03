export const vertexShaderSource = `#version 300 es
in vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

export const blackholeFragmentShaderSource = `#version 300 es
precision highp float;

uniform sampler2D u_backgroundTexture;
uniform vec2 u_resolution;
uniform float u_time;
uniform bool u_debugRawCapture;

uniform vec2 u_blackHoleCenter;
uniform float u_holeRadius;
uniform float u_lensDepth;
uniform float u_blackHoleMass;
uniform float u_photonRingBrightness;
uniform float u_diskInner;
uniform float u_diskOuter;
uniform float u_diskIncl;
uniform float u_diskRoll;
uniform float u_diskGain;
uniform float u_dopplerMix;
uniform float u_diskBeam;
uniform float u_exposure;
uniform float u_diskSpeed;
uniform float u_influenceScale;
uniform float u_edgeFadeWidth;

out vec4 outColor;

#define B_CRIT 2.5980762
#define N_STEPS 44

const float DISK_TEMP = 5500.0;
const float DISK_WIND = 7.0;
const float DISK_CONTRAST = 1.6;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float noiseWrapY(vec2 p, float periodY) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float y0 = mod(i.y, periodY);
  float y1 = mod(i.y + 1.0, periodY);
  return mix(
    mix(hash21(vec2(i.x, y0)), hash21(vec2(i.x + 1.0, y0)), f.x),
    mix(hash21(vec2(i.x, y1)), hash21(vec2(i.x + 1.0, y1)), f.x),
    f.y
  );
}

vec2 rot(vec2 v, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

vec3 blackbody(float temperature) {
  float t = clamp(temperature, 1500.0, 40000.0) / 100.0;
  float r = t <= 66.0 ? 1.0 : clamp(1.292936 * pow(t - 60.0, -0.1332047), 0.0, 1.0);
  float g = t <= 66.0 ? clamp(0.3900816 * log(t) - 0.6318414, 0.0, 1.0)
                      : clamp(1.1298909 * pow(t - 60.0, -0.0755148), 0.0, 1.0);
  float b = t >= 66.0 ? 1.0 : (t <= 19.0 ? 0.0 : clamp(0.5432068 * log(t - 10.0) - 1.1962540, 0.0, 1.0));
  return vec3(r, g, b);
}

vec3 sampleScene(vec2 uv) {
  return texture(u_backgroundTexture, clamp(uv, 0.0, 1.0)).rgb;
}

float ring(float radius, float center, float width) {
  return exp(-pow((radius - center) / max(width, 0.0001), 2.0));
}

void main() {
  vec2 resolution = max(u_resolution, vec2(1.0));
  vec2 uv = vec2(gl_FragCoord.x, resolution.y - gl_FragCoord.y) / resolution;
  vec3 base = sampleScene(uv);

  if (u_debugRawCapture) {
    outColor = vec4(base, 1.0);
    return;
  }

  float aspect = resolution.x / max(resolution.y, 1.0);
  vec2 p = (uv - u_blackHoleCenter) * vec2(aspect, 1.0);
  float plen = length(p);
  float rh = clamp(u_holeRadius, 0.006, 0.12) * u_blackHoleMass;
  float influenceRadius = max(u_influenceScale, 2.0) * rh;

  float influence = exp(-pow(plen / max(influenceRadius, 0.0001), 2.0));
  float farFade = 1.0 - smoothstep(influenceRadius * 1.15, influenceRadius * (1.15 + max(u_edgeFadeWidth, 0.02)), plen);
  float displacementWindow = influence * farFade;

  if (displacementWindow < 0.0008 && plen > rh * 1.8) {
    outColor = vec4(base, 1.0);
    return;
  }

  float W = B_CRIT / max(rh, 0.0001);
  vec2 pr = rot(vec2(p.x, -p.y), u_diskRoll) * W;
  float b = length(pr);
  float rin = max(u_diskInner, 1.6);
  float rout = max(u_diskOuter, rin + 0.5);
  float bmax = rout + 3.0;
  float z0 = max(14.0, rout + 5.0);

  vec3 color = base;
  vec3 diskEmit = vec3(0.0);
  float trans = 1.0;
  bool captured = false;
  float winding = 0.0;

  if (b >= bmax) {
    float u = z0 * inversesqrt(z0 * z0 + b * b);
    float deflection = (2.0 / (W * W)) / max(plen, 0.0001)
      * (1.29 * u + 0.07) * max(u_lensDepth - 2.14 * u + 0.75, 0.0)
      * displacementWindow;
    vec2 dir = p / max(plen, 0.00001);
    vec2 sampleUv = u_blackHoleCenter + (p - dir * deflection) / vec2(aspect, 1.0);
    color = sampleScene(sampleUv);
  } else {
    vec3 x = vec3(pr, z0);
    vec3 v = vec3(0.0, 0.0, -1.0);
    float h2 = dot(pr, pr);

    float ci = cos(u_diskIncl);
    float si = sin(u_diskIncl);
    vec3 n = vec3(0.0, si, ci);
    vec3 e2 = vec3(0.0, ci, -si);
    float sPrev = dot(x, n);
    vec3 xPrev = x;
    vec2 oldDir = normalize(x.xy + vec2(0.0001));

    for (int i = 0; i < N_STEPS; i++) {
      float r2 = dot(x, x);
      if (r2 < 1.0) {
        captured = true;
        break;
      }
      if (x.z < -z0 && v.z < 0.0) {
        break;
      }
      if (r2 > 4.0 * z0 * z0) {
        break;
      }

      float r = sqrt(r2);
      float dt = clamp(0.16 * r, 0.03, 1.45);
      vec3 a = -1.5 * h2 * x / max(r2 * r2 * r, 0.0001);
      v += a * (0.5 * dt);
      x += v * dt;
      r2 = dot(x, x);
      r = sqrt(r2);
      a = -1.5 * h2 * x / max(r2 * r2 * r, 0.0001);
      v += a * (0.5 * dt);

      vec2 newDir = normalize(x.xy + vec2(0.0001));
      winding += abs(atan(oldDir.x * newDir.y - oldDir.y * newDir.x, dot(oldDir, newDir)));
      oldDir = newDir;

      float s = dot(x, n);
      if (s * sPrev < 0.0 && trans > 0.02) {
        float tc = sPrev / (sPrev - s);
        vec3 xc = mix(xPrev, x, tc);
        float rc = length(xc);
        if (rc > rin && rc < rout) {
          float band = smoothstep(rin, rin * 1.25, rc)
            * (1.0 - smoothstep(rout * 0.72, rout, rc));
          float phi = atan(dot(xc, e2), xc.x);
          float turns = phi / 6.2831853;
          float kep = pow(rin / rc, 1.5);
          float gloc = sqrt(max(1.0 - 1.5 / rc, 0.02));
          float swirl = rc * DISK_WIND * 0.12 - u_time * u_diskSpeed * kep * 5.0 * gloc;
          float streakA = noiseWrapY(vec2(rc * 2.8, turns * 19.0 + swirl * 3.0), 19.0);
          float streakB = noiseWrapY(vec2(rc * 1.0, turns * 9.0 + swirl * 1.5 + 7.0), 9.0);
          float streaks = 0.35 + DISK_CONTRAST * pow(streakA * 0.65 + streakB * 0.35, 2.0);

          vec3 gasDir = normalize(cross(n, xc));
          float beta = clamp(inversesqrt(max(2.0 * (rc - 1.0), 0.2)), 0.0, 0.99);
          float doppler = gloc / max(1.0 + beta * dot(gasDir, normalize(v)), 0.05);
          doppler = mix(1.0, doppler, u_dopplerMix);

          float xProfile = max(1.0 - sqrt(rin / rc), 0.0);
          float tempProfile = pow(rin / rc, 0.75) * pow(xProfile, 0.25) / 0.488;
          vec3 cbb = blackbody(DISK_TEMP * tempProfile * doppler);
          float boost = pow(max(doppler, 0.05), u_diskBeam);
          float density = band * streaks;

          diskEmit += trans * cbb * density * tempProfile * tempProfile * boost * u_diskGain * 2.2;
          trans *= 1.0 - clamp(0.82 * density, 0.0, 1.0);
        }
      }

      sPrev = s;
      xPrev = x;
    }

    if (!captured && dot(x, x) < 4.0) {
      captured = true;
    }

    if (captured) {
      color = vec3(0.0);
      trans = 0.0;
    } else {
      vec3 d = normalize(v);
      if (d.z < -0.05) {
        float tpl = (-u_lensDepth - x.z) / d.z;
        vec3 hp = x + d * tpl;
        vec2 q = rot(hp.xy, -u_diskRoll) / W;
        vec2 sp = vec2(q.x, -q.y);
        vec2 sampleUv = u_blackHoleCenter + (p + (sp - p) * displacementWindow) / vec2(aspect, 1.0);
        float toward = smoothstep(0.05, 0.35, -d.z);
        color = mix(base, sampleScene(sampleUv), toward);
      }
    }
  }

  float horizon = smoothstep(rh * 1.03, rh * 0.94, plen);
  float photonRing = ring(plen, rh * 1.035, rh * 0.045)
    * (0.55 + 0.45 * smoothstep(1.2, 4.5, winding))
    * u_photonRingBrightness;
  float secondaryRing = ring(plen, rh * 1.18, rh * 0.075) * 0.22 * u_photonRingBrightness;
  float glow = ring(plen, rh * 1.92, rh * 0.36) * 0.08 * u_diskGain * displacementWindow;
  vec3 diskColor = vec3(1.0) - exp(-diskEmit * u_exposure);

  color *= trans;
  color = mix(color, vec3(0.0), horizon);
  color += diskColor;
  color += vec3(1.0, 0.72, 0.32) * photonRing;
  color += vec3(0.95, 0.44, 0.16) * secondaryRing;
  color += vec3(1.0, 0.36, 0.08) * glow;

  outColor = vec4(color, 1.0);
}
`

export const errorFragmentShaderSource = `#version 300 es
precision highp float;
out vec4 outColor;

void main() {
  outColor = vec4(1.0, 0.0, 0.0, 1.0);
}
`
