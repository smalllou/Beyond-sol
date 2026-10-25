// L1 太阳系世界：艺术化尺度，轨道半径 R = 6·r^0.6（r 为天文单位），天体放大。
import * as THREE from 'three';
import { planetMaterial, glowSprite, NOISE } from '../fx/shaders.js';
import { skyDome, starPoints } from '../fx/space.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerp = (a, b, u) => a + (b - a) * u;
const sstep = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
export const artR = (au) => 6 * Math.pow(au, 0.6);

const PLANETS = [
  // 名称, 贴图, AU, 半径, 公转周期（年）, 初相
  ['水星', 'mercury', 0.39, 0.16, 0.24, 1.0],
  ['金星', 'venus', 0.72, 0.3, 0.62, 2.4],
  ['火星', 'mars', 1.52, 0.22, 1.88, 4.0],
  ['木星', 'jupiter', 5.2, 1.15, 11.86, 0.6],
  ['土星', 'saturn', 9.54, 0.95, 29.4, 5.3],
  ['天王星', 'uranus', 19.2, 0.55, 84, 3.1],
  ['海王星', 'neptune', 30.1, 0.53, 165, 4.6],
];

export class SolarWorld {
  constructor(tex) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.01, 30000);
    this.bloom = { strength: 1.0, radius: 0.6, threshold: 0.78 };
    this.minDist = 1; this.maxDist = 600;
    const S = this.scene;
    this.sky = skyDome(tex.milkyway); this.sky.rotation.set(0.9, 0.4, 0.3); S.add(this.sky);
    this.sky.material.uniforms.uExp.value = 0.8;
    this.stars = starPoints(9000, 8000, 9); S.add(this.stars);
    S.add(new THREE.AmbientLight(0x223044, 0.15));
    this.light = new THREE.PointLight(0xfff0dd, 60, 0, 1.0); S.add(this.light);

    // 太阳
    this.sunMat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: tex.sun }, uTime: { value: 0 }, uAge: { value: 1 }, uGain: { value: 1.7 } },
      vertexShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying vec3 vL;
        void main(){ vUv = uv; vL = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
        #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_fragment>
        uniform sampler2D uMap; uniform float uTime, uAge, uGain; varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying vec3 vL;
        ${NOISE}
        void main(){
          #include <logdepthbuf_fragment>
          vec3 V = normalize(cameraPosition - vW);
          float mu = max(dot(normalize(vN), V), 0.0);
          vec3 p = normalize(vL);
          float gran = fbm(p * 38.0 + vec3(uTime * 0.05));
          float cells = fbm(p * 9.0 - vec3(uTime * 0.02));
          float spots = smoothstep(0.66, 0.74, fbm(p * 4.0 + 3.0));
          vec3 tex = texture2D(uMap, vUv + vec2(uTime * 0.002, 0.0)).rgb;
          float b = (0.65 + 0.7 * gran) * (0.8 + 0.4 * cells) * (1.0 - spots * 0.75);
          vec3 hot = mix(vec3(1.0, 0.45, 0.12), vec3(1.0, 0.86, 0.6), b);
          vec3 col = hot * (0.5 + tex * 0.9) * b;
          col *= pow(mu, 0.45) * 0.85 + 0.15;          // 临边昏暗
          col = mix(col, col * vec3(1.15, 0.8, 0.55), (1.0 - mu) * 0.6);
          gl_FragColor = vec4(col * uGain * uAge, 1.0);
        }`,
    });
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(2.2, 128, 64), this.sunMat); S.add(this.sun);
    this.corona = glowSprite(new THREE.Color(1.6, 0.9, 0.45), 9, { power: 3.2, opacity: 0.6 }); S.add(this.corona);
    this.corona2 = glowSprite(new THREE.Color(1.2, 0.6, 0.3), 26, { power: 6, opacity: 0.25 }); S.add(this.corona2);
    this._buildFlares();

    // 行星与轨道
    this.planets = PLANETS.map(([zh, key, au, r, per, ph]) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 32), planetMaterial(tex[key], { rimGain: 0.25 }));
      S.add(m);
      const orbit = this._orbit(artR(au), 0x7d93b5, 0.32); S.add(orbit);
      const o = { zh, key, au, r, per, ph, mesh: m, R: artR(au) };
      if (key === 'saturn') {
        const rg = new THREE.RingGeometry(r * 1.3, r * 2.3, 128);
        const pos = rg.attributes.position, uv = rg.attributes.uv;
        for (let i = 0; i < pos.count; i++) { const rr = Math.hypot(pos.getX(i), pos.getY(i)); uv.setXY(i, (rr - r * 1.3) / (r), 0.5); }
        const ring = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ map: tex.saturn_ring, transparent: true, side: THREE.DoubleSide, depthWrite: false, color: new THREE.Color(1.3, 1.25, 1.1) }));
        ring.rotation.x = -Math.PI / 2 + 0.45; m.add(ring);
      }
      return o;
    });
    // 地球与其航迹
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(0.34, 64, 32), planetMaterial(tex.earth_day, { rim: new THREE.Color(0.4, 0.7, 1.4), rimGain: 1.2 })); S.add(this.earth);
    this.earthGlow = glowSprite(new THREE.Color(0.6, 0.75, 1.8), 2.4, { power: 3, opacity: 0.8 }); S.add(this.earthGlow);
    this.earthOrbit = this._orbit(artR(1), 0x9fc2ff, 0.5); S.add(this.earthOrbit);
    this.trailN = 600;
    this.trail = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xd8e8ff, dashSize: 0.5, gapSize: 0.35, transparent: true, opacity: 0.9 }));
    S.add(this.trail);
    this.plume = glowSprite(new THREE.Color(0.7, 0.55, 2.0), 1.4, { power: 2, opacity: 0.6 }); S.add(this.plume);
    // 小行星带与柯伊伯带
    S.add(this._belt(5200, 2.1, 3.3, 0.18, 0x9a8a78, 1.6));
    S.add(this._belt(9000, 32, 50, 1.8, 0x6f86a8, 1.4));
    // 日球层顶
    const hg = new THREE.SphereGeometry(artR(120), 96, 48);
    this.helio = new THREE.Mesh(hg, new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `#include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
        #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <common>
        #include <logdepthbuf_pars_fragment>
        varying vec3 vN; varying vec3 vW;
        void main(){
        #include <logdepthbuf_fragment>
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(cameraPosition - vW))), 4.0); gl_FragColor = vec4(vec3(0.45, 0.3, 0.9) * f * 0.35, 1.0); }`,
    }));
    S.add(this.helio);
    this.state = {};
  }

  _orbit(R, color, op) {
    const pts = []; for (let i = 0; i <= 256; i++) { const a = i / 256 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R)); }
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false }));
  }
  _belt(n, a0, a1, thick, color, size) {
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const R = artR(a0 + Math.random() * (a1 - a0)), a = Math.random() * Math.PI * 2; p.set([Math.cos(a) * R, (Math.random() - .5) * thick, Math.sin(a) * R], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color, size, sizeAttenuation: false, transparent: true, opacity: 0.55, depthWrite: false }));
  }
  _buildFlares() {
    // 日珥：贴在临边的拱形管道
    this.loops = new THREE.Group(); this.scene.add(this.loops);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `#include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <common>
        #include <logdepthbuf_pars_fragment>
        uniform float uTime; varying vec2 vUv;
        ${NOISE}
        void main(){
          #include <logdepthbuf_fragment>
          float n = fbm(vec3(vUv.x * 12.0 - uTime * 0.8, vUv.y * 3.0, uTime * 0.2));
          float a = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
          gl_FragColor = vec4(vec3(2.6, 0.9, 0.3) * (0.4 + n * 1.4) * a, 1.0); }`,
    });
    this.loopMat = mat;
    const mk = (lat, lon, h, w) => {
      const pts = []; for (let i = 0; i <= 40; i++) { const u = i / 40, a = (u - 0.5) * w; const r = 2.2 + Math.sin(u * Math.PI) * h; pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(u * Math.PI) * h * 0.25, Math.sin(a) * r)); }
      const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.035 + h * 0.03, 8, false);
      const m = new THREE.Mesh(g, mat); m.rotation.set(lat, lon, 0); this.loops.add(m);
    };
    for (let i = 0; i < 9; i++) mk((Math.random() - .5) * 1.4, Math.random() * Math.PI * 2, 0.4 + Math.random() * 1.1, 0.25 + Math.random() * 0.35);
    // 日冕物质抛射：粒子从一点喷出
    const n = 5000, p = new Float32Array(n * 3), d = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { const v = new THREE.Vector3(1, (Math.random() - .5) * 0.9, (Math.random() - .5) * 0.9).normalize(); d.set([v.x, v.y, v.z, Math.random()], i * 4); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aD', new THREE.BufferAttribute(d, 4));
    this.cme = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `#include <common>
        #include <logdepthbuf_pars_vertex>
        attribute vec4 aD; uniform float uT; varying float vA;
        void main(){ float s = uT * (0.6 + aD.w * 1.4); vec3 p = aD.xyz * (2.2 + s * 9.0) + vec3(0.0, sin(aD.w * 40.0) * s * 0.6, 0.0);
          vA = (1.0 - clamp(s / 1.6, 0.0, 1.0)) * step(0.001, uT);
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = (2.0 + aD.w * 3.0) * 30.0 / -mv.z;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <common>
        #include <logdepthbuf_pars_fragment>
        varying float vA; void main(){
        #include <logdepthbuf_fragment>
        vec2 c = gl_PointCoord * 2.0 - 1.0; float r = dot(c,c); if (r > 1.0) discard; gl_FragColor = vec4(vec3(2.4, 1.2, 0.5) * exp(-r * 3.0) * vA, 1.0); }`,
    }));
    this.cme.frustumCulled = false; this.cme.rotation.y = 0.5; this.scene.add(this.cme);
  }

  // 影片时间 → 地球的日心距离（AU）
  earthAU(t) { return t < 36 ? 1 : Math.pow(10, Math.min(1, (t - 36) / 16)); }

  shot(t) {
    if (t >= 36 && t < 45.2) {
      const u = (t - 36) / 9.2;
      const a = lerp(0.9, 1.35, u);
      const d = lerp(46, 58, u);
      return { pos: V(Math.cos(a) * d, lerp(26, 22, u), Math.sin(a) * d), look: V(lerp(2, 4, u), 0, lerp(-2, -4, u)), fov: 42 };
    }
    if (t >= 45.2 && t < 52.5) {
      const u = (t - 45.2) / 7.3;
      return { pos: V(lerp(7.6, 8.6, u), lerp(1.6, 2.2, u), lerp(6.6, 7.4, u)), look: V(1.2, 0.6, -0.6), fov: 44 };
    }
    // 探索模式默认
    return { pos: V(40, 25, 40), look: V(0, 0, 0), fov: 42 };
  }
  range(t) { return t < 45.2 ? 1.5e9 + (t - 36) * 2.5e8 : 2.2e6; }

  update(t, dt, clock) {
    const years = (t - 36) * (15 / 16); // 时间压缩：约 1 年 / 秒
    const yr = Math.max(0, years);
    this.sunMat.uniforms.uTime.value = clock; this.loopMat.uniforms.uTime.value = clock;
    this.sun.rotation.y = clock * 0.02;
    // 太阳衰老：缓慢膨胀
    const age = 1 + sstep(36, 52, t) * 0.12;
    this.sun.scale.setScalar(age); this.loops.scale.setScalar(age);
    this.loops.visible = t > 44;
    // CME
    const cmeT = t - 47.2;
    this.cme.material.uniforms.uT.value = cmeT > 0 ? cmeT * 0.35 : 0;
    for (const p of this.planets) {
      const a = p.ph + yr / p.per * Math.PI * 2;
      p.mesh.position.set(Math.cos(a) * p.R, 0, Math.sin(a) * p.R);
      p.mesh.rotation.y = clock * 0.2;
      const s = p.mesh.position.clone().negate().normalize();
      p.mesh.material.uniforms.uSun.value.copy(s);
    }
    // 地球：沿外旋螺线离开
    const au = this.earthAU(t);
    const R = artR(au);
    const pts = [];
    const ang = (x) => 2.0 + (x < 36 ? 0 : (x - 36) * 0.38 - Math.pow(Math.max(0, x - 36) / 16, 1.6) * 3.2);
    for (let i = 0; i <= this.trailN; i++) { const x = 36 + (Math.max(t, 36) - 36) * i / this.trailN; const r = artR(this.earthAU(x)); const a = ang(x); pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
    this.trail.geometry.setFromPoints(pts); this.trail.computeLineDistances();
    const a = ang(Math.max(t, 36));
    this.earth.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
    this.earth.rotation.y = clock * 0.3;
    this.earth.material.uniforms.uSun.value.copy(this.earth.position.clone().negate().normalize());
    this.earthGlow.position.copy(this.earth.position);
    this.plume.position.copy(this.earth.position.clone().multiplyScalar(1 - 0.6 / R));
    this.helio.material.uniforms.uTime.value = clock;
    this.stars.material.uniforms.uTime.value = clock;
    this.corona.scale.setScalar(9 * age);
    const close = t >= 45.2 && t < 52.5;
    this.corona.material.uniforms.uOp.value = close ? 0.18 : 0.6;
    this.corona2.material.uniforms.uOp.value = close ? 0.0 : 0.25;
    this.sunMat.uniforms.uGain.value = close ? 0.75 : 1.7;
    this.state = { au };
  }

  destinations() {
    const d = [{ name: '太阳系全景', en: 'SOLAR SYSTEM', get: () => ({ target: V(0, 0, 0), dist: 70 }) },
      { name: '太阳', en: 'SOL', get: () => ({ target: V(0, 0, 0), dist: 9 }) },
      { name: '流浪地球', en: 'EARTH', get: () => ({ target: this.earth.position.clone(), dist: 3 }) }];
    for (const p of this.planets) d.push({ name: p.zh, en: p.key.toUpperCase(), get: () => ({ target: p.mesh.position.clone(), dist: p.r * 6 }) });
    return d;
  }
}
