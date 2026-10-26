// 共享着色器片段与常用材质
import * as THREE from 'three';

export const NOISE = /* glsl */`
float hash31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash31(i+vec3(0,0,0)), hash31(i+vec3(1,0,0)), f.x),
                 mix(hash31(i+vec3(0,1,0)), hash31(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash31(i+vec3(0,0,1)), hash31(i+vec3(1,0,1)), f.x),
                 mix(hash31(i+vec3(0,1,1)), hash31(i+vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
`;

// 地球：昼/夜/云影/镜面海洋/冰封
export function earthMaterial(tex) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uDay: { value: tex.earth_day }, uNight: { value: tex.earth_night }, uClouds: { value: tex.earth_clouds },
      uSpec: { value: tex.earth_spec }, uNormal: { value: tex.earth_normal },
      uSun: { value: new THREE.Vector3(1, 0, 0) }, uSunCol: { value: new THREE.Color(1, 0.97, 0.92) }, uSunInt: { value: 1.0 },
      uFreeze: { value: 0 }, uCity: { value: 1 }, uUnder: { value: 0 }, uTime: { value: 0 }, uCloudRot: { value: 0 }, uEngineGlow: { value: 0 },
      uGlowCenter: { value: new THREE.Vector3(0, 1, 0) },
    },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying vec3 vL;
      void main(){
        vUv = uv; vL = position;
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D uDay, uNight, uClouds, uSpec, uNormal;
      uniform vec3 uSun, uSunCol, uGlowCenter; uniform float uSunInt, uFreeze, uCity, uUnder, uTime, uCloudRot, uEngineGlow;
      varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying vec3 vL;
      ${NOISE}
      void main(){
        #include <logdepthbuf_fragment>
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        // 法线贴图（球面切线空间近似）
        vec3 up = vec3(0.0, 1.0, 0.0);
        vec3 T = normalize(cross(up, N) + 1e-5); vec3 B = cross(N, T);
        vec3 nm = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
        vec3 Np = normalize(N + (T * nm.x - B * nm.y) * 0.35);
        float ndl = dot(Np, uSun);
        float day = smoothstep(-0.12, 0.25, dot(N, uSun));
        float water = texture2D(uSpec, vUv).r;
        vec3 albedo = texture2D(uDay, vUv).rgb;
        // 冰封：陆地变灰白，海洋结冰
        float lum = dot(albedo, vec3(0.3, 0.55, 0.15));
        vec3 ice = mix(vec3(0.62, 0.72, 0.84), vec3(0.86, 0.92, 0.98), smoothstep(0.1, 0.5, lum));
        float iceN = fbm(vL * 9.0);
        vec3 seaIce = mix(vec3(0.55, 0.68, 0.82), vec3(0.82, 0.9, 0.97), iceN);
        vec3 frozen = mix(ice, seaIce, water) * 0.72;
        albedo = mix(albedo, frozen, uFreeze);
        float cl = texture2D(uClouds, vUv + vec2(uCloudRot, 0.0)).r;
        // 云影
        float shadow = 1.0 - 0.45 * texture2D(uClouds, vUv + vec2(uCloudRot + 0.0012, 0.0006)).r * (1.0 - uFreeze * 0.6);
        vec3 col = albedo * uSunCol * uSunInt * max(ndl, 0.0) * 1.15 * shadow;
        // 海面高光
        vec3 H = normalize(uSun + V);
        float spec = pow(max(dot(N, H), 0.0), 60.0) * water * (1.0 - uFreeze * 0.7);
        col += uSunCol * uSunInt * spec * 0.45 * day;
        // 夜面灯光：出发时只剩稀疏的残余城市灯（地表已大规模撤入地下城），冰封后熄灭；
        // 冰封期只留地下城出入口的零星冷色光点；抵达后（uCity 回升）亮起少量暖色返回地表的灯点
        vec3 night = texture2D(uNight, vUv).rgb;
        float nightMask = 1.0 - day;
        float sparkle = 0.75 + 0.5 * vnoise(vL * 220.0 + uTime * 0.3);
        float sparse = smoothstep(0.78, 0.86, vnoise(vL * 520.0));           // 只保留少数像素点，不成片
        col += night * night * vec3(1.0, 0.72, 0.38) * 2.6 * uCity * nightMask * sparkle * mix(1.0, sparse, 0.6);
        float hatch = smoothstep(0.86, 0.9, vnoise(vL * 900.0)) * step(0.25, night.r);
        col += vec3(0.45, 0.7, 1.1) * hatch * uUnder * mix(nightMask, 1.0, 0.3) * 0.5;
        // 发动机群照亮地表
        float g = max(dot(N, normalize(uGlowCenter)), 0.0);
        col += vec3(0.42, 0.36, 1.0) * pow(g, 18.0) * uEngineGlow * 0.6;
        // 大气散射边缘
        float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        vec3 atm = mix(vec3(0.25, 0.5, 1.0), vec3(0.75, 0.85, 1.0), uFreeze);
        col += atm * fr * (0.15 + 1.1 * day) * uSunInt;
        col = mix(col, col * vec3(0.92, 0.97, 1.08), uFreeze);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

export function cloudMaterial(tex) {
  return new THREE.ShaderMaterial({
    uniforms: { uClouds: { value: tex.earth_clouds }, uSun: { value: new THREE.Vector3(1, 0, 0) }, uSunInt: { value: 1 }, uSunCol: { value: new THREE.Color(1, 1, 1) }, uRot: { value: 0 }, uFreeze: { value: 0 } },
    transparent: true, depthWrite: false,
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D uClouds; uniform vec3 uSun, uSunCol; uniform float uSunInt, uRot, uFreeze; varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){
        #include <logdepthbuf_fragment>
        vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);
        float c = texture2D(uClouds, vUv + vec2(uRot, 0.0)).r;
        c = smoothstep(0.08, 0.9, c) * (1.0 - uFreeze * 0.55);
        float l = smoothstep(-0.15, 0.4, dot(N, uSun));
        float rim = pow(1.0 - max(dot(N, V), 0.0), 2.0);
        vec3 col = uSunCol * uSunInt * (0.04 + 1.05 * l) * mix(vec3(1.0), vec3(1.0, 0.86, 0.72), rim * l);
        gl_FragColor = vec4(col, c * (0.25 + 0.75 * l) * (1.0 - rim * 0.4));
      }`,
  });
}

export function atmosphereMaterial(color = new THREE.Color(0.3, 0.58, 1.0), power = 3.2, gain = 1.4) {
  return new THREE.ShaderMaterial({
    uniforms: { uSun: { value: new THREE.Vector3(1, 0, 0) }, uCol: { value: color }, uGain: { value: gain }, uPow: { value: power }, uSunInt: { value: 1 } },
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vN; varying vec3 vW;
      void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uSun, uCol; uniform float uGain, uPow, uSunInt; varying vec3 vN; varying vec3 vW;
      void main(){
        #include <logdepthbuf_fragment>
        vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);
        float f = pow(max(-dot(N, V) * 1.0, 0.0), uPow);
        float k = pow(1.0 - abs(dot(N, V)), 1.0);
        float l = smoothstep(-0.35, 0.5, dot(-N, -uSun) * -1.0 + 0.0);
        l = smoothstep(-0.3, 0.6, dot(N, uSun));
        float a = clamp(f * 2.5, 0.0, 1.0) * (0.12 + l * uSunInt);
        gl_FragColor = vec4(uCol * a * uGain, 1.0);
      }`,
  });
}

// 通用行星（贴图 + 晨昏线 + 边缘光）
export function planetMaterial(map, { rim = new THREE.Color(0.5, 0.6, 0.9), rimGain = 0.4, emissive = 0, grade = 0, freeze = 0 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uSun: { value: new THREE.Vector3(1, 0, 0) }, uSunInt: { value: 1 }, uRim: { value: rim }, uRimGain: { value: rimGain }, uEmi: { value: emissive }, uRingShadow: { value: 0 }, uRingN: { value: new THREE.Vector3(0, 1, 0) }, uCenter: { value: new THREE.Vector3() }, uGrade: { value: grade }, uFreeze: { value: freeze } },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D uMap; uniform vec3 uSun, uRim, uRingN, uCenter; uniform float uSunInt, uRimGain, uEmi, uRingShadow, uGrade, uFreeze;
      varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){
        #include <logdepthbuf_fragment>
        vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);
        vec3 c = texture2D(uMap, vUv).rgb;
        if (uFreeze > 0.0) { // 流浪地球：随远离太阳逐步冰封
          float lum = dot(c, vec3(0.3, 0.59, 0.11));
          vec3 ice = mix(vec3(0.42, 0.52, 0.66), vec3(0.95, 0.97, 1.0), smoothstep(0.06, 0.4, lum));
          c = mix(c, ice, uFreeze);
        }
        if (uGrade > 0.0) { // 原著：暗红色木星
          float lum = dot(c, vec3(0.3, 0.59, 0.11));
          float warm = clamp((c.r - c.b) * 3.0, 0.0, 1.0); // 大红斑、橙色带
          vec3 red = vec3(0.48, 0.11, 0.06) * pow(lum, 1.35) * 1.0;
          red = mix(red, vec3(0.62, 0.07, 0.03) * lum * 1.1, warm * 0.6);
          c = mix(c, red, uGrade);
        }
        float l = max(dot(N, uSun), 0.0);
        float term = smoothstep(-0.05, 0.3, dot(N, uSun));
        vec3 col = c * (l * 1.1 * uSunInt + 0.012) + c * uEmi;
        float fr = pow(1.0 - max(dot(N, V), 0.0), 2.5);
        col += uRim * fr * uRimGain * (0.1 + term) * uSunInt;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

// 柔光精灵（光晕、星点、新恒星）
export function glowSpriteMaterial(color, { power = 2.0, opacity = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uCol: { value: color }, uPow: { value: power }, uOp: { value: opacity } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv;
      void main(){ vUv = uv;
        vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vec2 s = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
        mv.xy += position.xy * s;
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uCol; uniform float uPow, uOp; varying vec2 vUv;
      void main(){
        #include <logdepthbuf_fragment>
        vec2 p = vUv * 2.0 - 1.0; float r = length(p);
        float g = pow(max(1.0 - r, 0.0), uPow);
        float core = exp(-r * r * 160.0) * 3.0;
        float rays = (exp(-abs(p.y) * 90.0) + exp(-abs(p.x) * 90.0)) * pow(max(1.0 - r, 0.0), 3.0) * 0.9;
        gl_FragColor = vec4(uCol * (g + core + rays) * uOp, 1.0);
      }`,
  });
}

export function glowSprite(color, size, opts) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowSpriteMaterial(color, opts));
  m.scale.set(size, size, 1);
  m.frustumCulled = false;
  return m;
}
