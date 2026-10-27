// L1 太阳系世界：艺术化尺度，轨道半径 R = 6·r^0.6（r 为天文单位），天体放大。
import * as THREE from 'three';
import { planetMaterial, glowSprite, NOISE } from '../fx/shaders.js';
import { skyDome, starPoints } from '../fx/space.js';
import { yearAt } from '../story.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerp = (a, b, u) => a + (b - a) * u;
const sstep = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const ENGINE_LON = 110 * Math.PI / 180; // 发动机半球中心经度（东亚）
export const artR = (au) => 6 * Math.pow(au, 0.6);
// 航迹时间轴（与 HUD 年份、行星公转共用 yearAt）：36–48 s 绕日椭圆，48–52 s 最后一圈爬向木星，
// 52 s 在最后一个远日点掠过木星（2075 年，与地球世界的木星镜头 52–60 s 对齐），之后在黄道面内飞向土星轨道，
// 60 s 掠过土星（仍在黄道面上），过了土星才向南偏转 44.8° 飞向比邻星
const T_LAP = 48, T_FLY = 52, T_SAT = 60;
const Y0 = 2058, yrs = (t) => yearAt(t) - Y0;

const PLANETS = [
  // 名称, 贴图, AU, 半径, 公转周期（年）, 初相, 自转轴倾角（度，空间中固定）
  ['水星', 'mercury', 0.39, 0.16, 0.24, 1.0, 0.03],
  ['金星', 'venus', 0.72, 0.3, 0.62, 2.4, 2.6],
  ['火星', 'mars', 1.52, 0.22, 1.88, 4.0, 25.2],
  ['木星', 'jupiter', 5.2, 1.15, 11.86, 0.6, 3.1],
  ['土星', 'saturn', 9.54, 0.95, 29.4, 5.3, 26.7],
  ['天王星', 'uranus', 19.2, 0.55, 84, 3.1, 97.8],
  ['海王星', 'neptune', 30.1, 0.53, 165, 4.6, 28.3],
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
    this.planets = PLANETS.map(([zh, key, au, r, per, ph, tilt]) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 32), planetMaterial(tex[key], { rimGain: 0.25 }));
      S.add(m);
      const orbit = this._orbit(artR(au), 0x7d93b5, 0.32); S.add(orbit);
      const o = { zh, key, au, r, per, ph, tilt: tilt * Math.PI / 180, mesh: m, R: artR(au) };
      if (key === 'saturn') {
        const rg = new THREE.RingGeometry(r * 1.3, r * 2.3, 128);
        const pos = rg.attributes.position, uv = rg.attributes.uv;
        for (let i = 0; i < pos.count; i++) { const rr = Math.hypot(pos.getX(i), pos.getY(i)); uv.setXY(i, (rr - r * 1.3) / (r), 0.5); }
        const ring = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ map: tex.saturn_ring, transparent: true, side: THREE.DoubleSide, depthWrite: false, color: new THREE.Color(1.3, 1.25, 1.1) }));
        ring.rotation.x = -Math.PI / 2; m.add(ring); // 光环位于赤道面，随星体姿态而定，不再单独倾斜
      }
      return o;
    });
    // 地球与其航迹
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(0.34, 64, 32), planetMaterial(tex.earth_day, { rim: new THREE.Color(0.4, 0.7, 1.4), rimGain: 1.2, freeze: 0.001 })); S.add(this.earth);
    this.engines = this._engines(0.34); this.earth.add(this.engines);
    this.earthGlow = glowSprite(new THREE.Color(0.6, 0.75, 1.8), 2.4, { power: 3, opacity: 0.8 }); S.add(this.earthGlow);
    this.earthOrbit = this._orbit(artR(1), 0x9fc2ff, 0.5); S.add(this.earthOrbit);
    // 冥王星：a 39.48 AU、e 0.2488、i 17.16°、Ω 110.3°、ω 113.8°（偏心且倾斜，用虚线、偏暗区分）；黄道坐标 X→x、Y→z、Z→y，
    // 每个点按艺术化尺度 artR(r) 缩放日心距（方向不变）；位置按 1989.7 年过近日点、周期 247.9 年推算
    this.plutoEl = { a: 39.48, e: 0.2488, i: 17.16 * Math.PI / 180, O: 110.3 * Math.PI / 180, w: 113.8 * Math.PI / 180, tp: 1989.7, per: 247.9 };
    const pp = []; for (let k = 0; k <= 512; k++) pp.push(this._plutoPos(k / 512 * Math.PI * 2));
    this.plutoOrbit = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pp), new THREE.LineDashedMaterial({ color: 0xffc58a, transparent: true, opacity: 0.95, dashSize: 1.6, gapSize: 1.0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.plutoOrbit.computeLineDistances(); S.add(this.plutoOrbit);
    // WebGL 线宽固定 1 px：再叠两条略放大/缩小的同样虚线，形成约 2–3 px 的暖色虚线
    for (const k of [1.004, 0.996]) { const l = new THREE.Line(this.plutoOrbit.geometry, this.plutoOrbit.material); l.scale.setScalar(k); S.add(l); }
    this.pluto = new THREE.Mesh(new THREE.SphereGeometry(0.2, 48, 24), planetMaterial(tex.pluto || tex.mercury, { rim: new THREE.Color(1.0, 0.8, 0.6), rimGain: 0.5 })); S.add(this.pluto);   // 新视野号全球彩色拼接图（NASA/JHUAPL/SwRI，public domain）
    this._buildPath();
    // 木星引力弹弓：初相按 52 s（同一条年份曲线）地球最后一个远日点的方位反推，木星恰在远日点前方外侧擦身而过
    const jup = this.planets.find((p) => p.key === 'jupiter');
    jup.ph = this._fly.ang + 0.08 - yrs(T_FLY) / jup.per * Math.PI * 2;
    // 土星：60 s 时恰在航迹旁（黄道面内），航迹从土星轨道内侧掠过
    const sat = this.planets.find((p) => p.key === 'saturn');
    const ps = this.pathPos(T_SAT);
    sat.ph = Math.atan2(ps.z, ps.x) - yrs(T_SAT) / sat.per * Math.PI * 2;
    // 完整航线：走过的亮青实线，前方暗淡流动虚线；10 AU 之后继续斜向黄道面以南（比邻星方向）渐隐
    const N = 1400, T1 = 70, pts = [], aS = new Float32Array(N + 1), aL = new Float32Array(N + 1), aF = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) { const x = 36 + (T1 - 36) * i / N; pts.push(this.pathPos(x)); aS[i] = (x - 36) / 16; aF[i] = 1 - sstep(60, T1, x); if (i) aL[i] = aL[i - 1] + pts[i].distanceTo(pts[i - 1]); }
    const tg = new THREE.BufferGeometry().setFromPoints(pts);
    tg.setAttribute('aS', new THREE.BufferAttribute(aS, 1)); tg.setAttribute('aL', new THREE.BufferAttribute(aL, 1)); tg.setAttribute('aF', new THREE.BufferAttribute(aF, 1));
    this.trackMat = new THREE.ShaderMaterial({
      uniforms: { uProg: { value: 0 }, uA: { value: 0 }, uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float aS; attribute float aL; attribute float aF; varying float vS; varying float vL; varying float vF; void main(){ vS = aS; vL = aL; vF = aF; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uProg, uA, uTime; varying float vS; varying float vL; varying float vF;
        void main(){ float past = step(vS, uProg); float dash = step(0.45, fract(vL / 1.1 - uTime * 0.5));
          vec3 c = mix(vec3(0.6, 1.0, 1.9) * 1.1 * dash, vec3(1.0, 1.7, 2.8), past);
          gl_FragColor = vec4(c * uA * vF, 1.0); }`,
    });
    this.track = new THREE.Line(tg, this.trackMat); this.track.frustumCulled = false; S.add(this.track);
    // 比邻星方向标注：放在过了土星、向南偏转之后的航线上
    const lp = this.pathPos(65);
    this.trackLabel = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false, opacity: 0 }));
    this.trackLabel.position.copy(lp); this.trackLabel.center.set(-0.06, 0.5); this.trackLabel.scale.set(20, 5, 1); S.add(this.trackLabel);
    const drawLabel = () => {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const g = c.getContext('2d');
      g.fillStyle = 'rgba(200,228,255,0.95)'; g.font = '600 76px SC, sans-serif'; g.textBaseline = 'middle'; g.fillText('比邻星 · 4.2 光年', 8, 92);
      g.fillStyle = 'rgba(160,200,255,0.75)'; g.font = '500 44px Raj, sans-serif'; g.fillText('PROXIMA CENTAURI  ·  4.2 LY', 10, 184);
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; this.trackLabel.material.map = tx; this.trackLabel.material.needsUpdate = true;
    };
    drawLabel();
    if (document.fonts) document.fonts.load('600 76px SC', '比邻星光年').then(drawLabel).catch(() => {});
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

  // 冥王星轨道上真近点角 nu 处的场景坐标
  _plutoPos(nu) {
    const { a, e, i, O, w } = this.plutoEl, r = a * (1 - e * e) / (1 + e * Math.cos(nu)), u = nu + w;
    const X = Math.cos(O) * Math.cos(u) - Math.sin(O) * Math.sin(u) * Math.cos(i), Y = Math.sin(O) * Math.cos(u) + Math.cos(O) * Math.sin(u) * Math.cos(i), Z = Math.sin(u) * Math.sin(i);
    return V(X, Z, Y).multiplyScalar(artR(r));
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
  // 行星发动机：背向半球上的发动机光点 + 平行喷流束（作为地球子物体随之定向）
  _engines(r) {
    const g = new THREE.Group();
    const axis = V(Math.cos(ENGINE_LON), 0, -Math.sin(ENGINE_LON)); // 本地坐标中东亚经度方向
    const up = V(0, 1, 0), side = new THREE.Vector3().crossVectors(up, axis).normalize();
    const rnd = (() => { let x = 20790; return () => (x = (x * 16807) % 2147483647) / 2147483647; })();
    const pos = [], beam = [], idx = [];
    const N = 46, L = 1.6;
    for (let i = 0; i < N; i++) {
      // 在半球中心 55° 范围内取点
      const th = Math.acos(1 - rnd() * (1 - Math.cos(0.95))), ph = rnd() * Math.PI * 2;
      const d = axis.clone().multiplyScalar(Math.cos(th)).addScaledVector(side, Math.sin(th) * Math.cos(ph)).addScaledVector(up, Math.sin(th) * Math.sin(ph)).normalize();
      const p0 = d.clone().multiplyScalar(r * 1.003);
      pos.push(p0.x, p0.y, p0.z);
      // 每束喷流：沿发动机轴（平行）伸出，两片十字交叉面片
      const w = 0.006 + rnd() * 0.006, len = L * (0.6 + rnd() * 0.5), seed = rnd();
      for (const n of [side, up]) {
        const b = beam.length / 6;
        for (const [s, v] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) {
          const q = p0.clone().addScaledVector(n, s * w * (1 + v * 2.5)).addScaledVector(axis, v * len);
          beam.push(q.x, q.y, q.z, s, v, seed);
        }
        idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.add(new THREE.Points(pg, new THREE.PointsMaterial({ color: new THREE.Color(0.75, 0.85, 2.2), size: 0.025, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    const bg = new THREE.BufferGeometry();
    const arr = new Float32Array(beam), P = [], A = [];
    for (let i = 0; i < arr.length; i += 6) { P.push(arr[i], arr[i + 1], arr[i + 2]); A.push(arr[i + 3], arr[i + 4], arr[i + 5]); }
    bg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); bg.setAttribute('aB', new THREE.Float32BufferAttribute(A, 3)); bg.setIndex(idx);
    this.engineMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `#include <common>
        #include <logdepthbuf_pars_vertex>
        attribute vec3 aB; varying vec3 vB; void main(){ vB = aB; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <common>
        #include <logdepthbuf_pars_fragment>
        uniform float uTime; varying vec3 vB; void main(){
        #include <logdepthbuf_fragment>
        float across = 1.0 - abs(vB.x); across = across * across;
        float along = pow(1.0 - vB.y, 1.6);
        float flick = 0.85 + 0.15 * sin(uTime * 9.0 + vB.z * 40.0);
        vec3 col = mix(vec3(1.4, 1.6, 2.6), vec3(0.45, 0.38, 1.9), vB.y);
        gl_FragColor = vec4(col * across * along * flick * 0.55, 1.0); }`,
    });
    const beams = new THREE.Mesh(bg, this.engineMat); beams.frustumCulled = false; g.add(beams);
    return g;
  }

  // 航迹（据原著与电影）：逃逸时代地球绕太阳越转越扁的椭圆加速（原著为 15 圈；电影为 2058–2068 绕日十年；这里画 3.5 圈代表），近日点约 1 AU，
  // 最后一圈的远日点到达木星轨道，擦过木星借引力弹弓甩出，随后近乎直线斜向黄道面以南的比邻星方向飞去
  _buildPath() {
    const LAPS = 3.5, PH = LAPS * Math.PI * 2, M = 4000, QF = 4.9;
    const Q = (f) => 1 + (QF - 1) * Math.pow(f, 1.35);
    const rAU = (f) => { const q = 1, Qf = Q(f), c = Math.cos(f * PH); return 2 * q * Qf / ((Qf + q) + (Qf - q) * c); };
    // 开普勒第二定律：dt ∝ r² dφ
    const cum = new Float64Array(M + 1);
    for (let i = 1; i <= M; i++) { const f = (i - 0.5) / M; const r = rAU(f); cum[i] = cum[i - 1] + r * r; }
    this._lap = { M, cum, tot: cum[M], rAU, PH };
    const A0 = 2.0;
    const fly = this._lapPos(1);
    const R = fly.length(), ang = Math.atan2(fly.z, fly.x);
    const radial = V(Math.cos(ang), 0, Math.sin(ang)), pro = V(-Math.sin(ang), 0, Math.cos(ang));
    // 甩出方向：外向偏前进方向 40°，再压到黄道面以南 44.8°（比邻星黄纬约 −44.8°）
    const hz = radial.clone().multiplyScalar(Math.cos(0.7)).addScaledVector(pro, Math.sin(0.7)).normalize();
    const lat = -44.8 * Math.PI / 180, D = hz.clone().multiplyScalar(Math.cos(lat)).add(V(0, Math.sin(lat), 0)).normalize();
    // 黄道面内段长度：60 s 时恰好到达土星轨道内侧 0.5（P(60) = P0 + 2.5·LEN·hz）
    const Rs = artR(9.54) - 0.5, b = fly.dot(hz), k = -b + Math.sqrt(b * b - fly.lengthSq() + Rs * Rs);
    // 最后一圈的起点：远日点 f = 2.5/3.5（48 s），之前 2.5 圈在 36–48 s 内走完
    const iA = Math.round(this._lap.M * 2.5 / LAPS);
    this._fly = { P: fly, ang, R, pro, D, H: hz, A0, LEN: k / 2.5, cA: this._lap.cum[iA] };
  }
  _lapPos(f) {
    const L = this._lap, r = artR(L.rAU(f)), a = 2.0 + f * L.PH;
    return V(Math.cos(a) * r, 0, Math.sin(a) * r);
  }
  pathPos(x) {
    if (x <= 36) return this._lapPos(0);
    if (x <= T_FLY) {
      // 用年份（开普勒第二定律的时间）推进：36–48 s 走完前 2.5 圈，48–52 s 走最后一圈到木星
      const L = this._lap, F = this._fly, y = yrs(x), yA = yrs(T_LAP), yF = yrs(T_FLY);
      const target = y <= yA ? (y / yA) * F.cA : F.cA + (y - yA) / (yF - yA) * (L.tot - F.cA);
      let lo = 0, hi = L.M; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L.cum[m] < target) lo = m; else hi = m; }
      const f = (lo + (target - L.cum[lo]) / Math.max(1e-9, L.cum[hi] - L.cum[lo])) / L.M;
      return this._lapPos(f);
    }
    // 掠过木星后：Hermite 曲线从远日点的切向转到黄道面内的甩出方向，匀速飞到土星轨道（60 s）；
    // 过了土星再用一段 Hermite 曲线向南偏转 44.8°，之后沿比邻星方向匀速直线
    const F = this._fly, LEN = F.LEN, v = LEN / 3 * 0.9;
    const herm = (P0, T0, P1, T1, u) => { const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2; return P0.clone().multiplyScalar(h00).addScaledVector(T0, h10).addScaledVector(P1, h01).addScaledVector(T1, h11); };
    const P1 = F.P.clone().addScaledVector(F.H, LEN);
    if (x < T_FLY + 3) return herm(F.P, F.pro.clone().multiplyScalar(LEN * 0.9), P1, F.H.clone().multiplyScalar(LEN), (x - T_FLY) / 3);
    const Ps = P1.clone().addScaledVector(F.H, (T_SAT - T_FLY - 3) * v);
    if (x < T_SAT) return P1.clone().addScaledVector(F.H, (x - T_FLY - 3) * v);
    const L2 = v * 3, P2 = Ps.clone().addScaledVector(F.H, L2 * 0.5).addScaledVector(F.D, L2 * 0.5);
    if (x < T_SAT + 3) return herm(Ps, F.H.clone().multiplyScalar(L2), P2, F.D.clone().multiplyScalar(L2), (x - T_SAT) / 3);
    return P2.clone().addScaledVector(F.D, (x - T_SAT - 3) * v);
  }
  earthAU(t) { const r = this.pathPos(t).length(); return Math.pow(r / 6, 1 / 0.6); }

  shot(t) {
    if (t >= 36 && t < 45.2) {
      const u = (t - 36) / 9.2;
      const a = lerp(0.9, 1.35, u);
      const d = lerp(46, 58, u);
      const wide = { pos: V(Math.cos(a) * d, lerp(26, 22, u), Math.sin(a) * d), look: V(lerp(2, 4, u), 0, lerp(-2, -4, u)), fov: 42 };
      // 开头 4 秒接第一章的拉远：从与上一镜同样大小的地球（约 16 个地球半径外）对数式继续拉远到全景
      if (t < 40) {
        const E = this.earth.position, k = sstep(36, 40, t);
        const dir = wide.pos.clone().sub(E), dw = dir.length(); dir.divideScalar(dw);
        const dist = Math.exp(lerp(Math.log(0.34 * 16), Math.log(dw), k));
        return { pos: E.clone().addScaledVector(dir, dist), look: E.clone().lerp(wide.look, k), fov: 42 };
      }
      return wide;
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
    const years = yrs(t); // 与 HUD 年份同一条曲线
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
    { // 冥王星位置（开普勒方程）
      const P = this.plutoEl, M = ((Y0 + yr - P.tp) / P.per) * Math.PI * 2; let E = M;
      for (let k = 0; k < 12; k++) E -= (E - P.e * Math.sin(E) - M) / (1 - P.e * Math.cos(E));
      const nu = 2 * Math.atan2(Math.sqrt(1 + P.e) * Math.sin(E / 2), Math.sqrt(1 - P.e) * Math.cos(E / 2));
      this.pluto.position.copy(this._plutoPos(nu)); this.pluto.material.uniforms.uSun.value.copy(this.pluto.position).negate().normalize();
    }
    for (const p of this.planets) {
      const a = p.ph + yr / p.per * Math.PI * 2;
      p.mesh.position.set(Math.cos(a) * p.R, 0, Math.sin(a) * p.R);
      // 自转轴先固定倾斜，再绕自身极轴自转（Euler XYZ：R = Rx(倾角)·Ry(自转)），光环不会再摇摆
      p.mesh.rotation.set(p.tilt, clock * 0.2, 0);
      const s = p.mesh.position.clone().negate().normalize();
      p.mesh.material.uniforms.uSun.value.copy(s);
    }
    // 地球：沿外旋螺线离开
    const au = this.earthAU(t);
    // 航线：拉远结束后淡入，太阳近景时调暗
    const tA = sstep(37.6, 40, t) * (t >= 45.2 && t < 52.5 ? 0.3 : 1);
    this.trackMat.uniforms.uA.value = tA; this.trackMat.uniforms.uProg.value = Math.min(1, Math.max(0, (t - 36) / 16)); this.trackMat.uniforms.uTime.value = clock;
    this.track.visible = tA > 0.002;
    this.trackLabel.material.opacity = tA * sstep(39, 42, t) * (t >= 45.2 && t < 52.5 ? 0 : 0.9); this.trackLabel.visible = this.trackLabel.material.opacity > 0.002;
    this.earth.position.copy(this.pathPos(t));
    // 刹车时代已停转：不再自转，发动机半球（东亚）始终朝向航迹后方，喷流逆着前进方向
    const back = this.earth.position.clone().sub(this.pathPos(Math.max(t, 36) + 0.05)); back.y = 0;
    if (back.lengthSq() < 1e-10) { const a = Math.atan2(this.earth.position.z, this.earth.position.x); back.set(-Math.sin(a), 0, Math.cos(a)); } // 出发前：沿切向反方向
    back.normalize();
    this.earth.rotation.y = Math.atan2(-back.z, back.x) - ENGINE_LON;
    this.earth.material.uniforms.uSun.value.copy(this.earth.position.clone().negate().normalize());
    // 冰封：椭圆轨道会反复回到近日点，改按远日点逐圈外推的时间推进（约 2 AU 起变白，到木星时全白），不随单圈来回解冻
    this.earth.material.uniforms.uFreeze.value = 0.001 + sstep(38.5, T_FLY, t) * 0.95; void au;
    this.engineMat.uniforms.uTime.value = clock;
    this.earthGlow.position.copy(this.earth.position);
    // 拉近时收起远景光晕，避免像旁边多了个光源
    const camD = this.camera.position.distanceTo(this.earth.position);
    this.earthGlow.material.uniforms.uOp.value = 0.8 * sstep(4, 14, camD);
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
