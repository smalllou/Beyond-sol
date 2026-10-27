// L2 银河世界：1 单位 = 1 光年，太阳位于原点。程序化四旋臂棒旋星系 + 猎户臂。
import * as THREE from 'three';
import { glowSprite } from '../fx/shaders.js';
import { skyDome, starPoints } from '../fx/space.js';
import { NEAR_STARS, NEAR_NAMES } from '../data/near-stars.js';
import { distAU, AU_PER_LY } from '../story.js';

// 文字标注：画布贴图精灵（sizeAttenuation: false → 屏幕上恒定大小）；中文用 HUD 的 SC（NotoSansSC-hud），英文用 Raj
// 画面高 540 px、fov 45° 时 scale.y = 像素高 / 270 × tan(22.5°)
const LABEL_H_PX = 46, LABEL_SY = LABEL_H_PX / 270 * Math.tan(22.5 * Math.PI / 180);
function makeLabel(zh, en, center, color = 'rgba(205,228,255,0.95)', k = 1) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false, opacity: 0, sizeAttenuation: false }));
  sp.center.set(center[0], center[1]); sp.scale.set(LABEL_SY * 4 * k, LABEL_SY * k, 1); sp.renderOrder = 10;
  const draw = () => {
    const c = document.createElement('canvas'); let g = c.getContext('2d');
    // 画布宽度按文字实际宽度裁切，使标签能紧贴锚点（左右两侧都可）
    g.font = '500 92px SC, sans-serif'; const w1 = g.measureText(zh).width; g.font = '600 60px Raj, sans-serif'; const w2 = g.measureText(en).width;
    c.width = Math.ceil(Math.max(w1, w2) + 28); c.height = 256; g = c.getContext('2d');
    sp.scale.set(LABEL_SY * k * c.width / 256, LABEL_SY * k, 1);
    g.shadowColor = 'rgba(0,0,0,0.85)'; g.shadowBlur = 10; g.textBaseline = 'middle';
    g.fillStyle = color; g.font = '500 92px SC, sans-serif'; g.fillText(zh, 10, 82);
    g.fillStyle = 'rgba(165,195,235,0.82)'; g.font = '600 60px Raj, sans-serif'; g.fillText(en, 12, 192);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
    if (sp.material.map) sp.material.map.dispose(); sp.material.map = tx; sp.material.needsUpdate = true;
  };
  draw();
  if (document.fonts) Promise.all([document.fonts.load('500 92px SC', zh), document.fonts.load('600 60px Raj', en)]).then(draw).catch(() => {});
  return sp;
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerp = (a, b, u) => a + (b - a) * u;
const sstep = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };

const R_SUN = 26000, PITCH = 12.5 * Math.PI / 180, R0 = 3600;
function gauss(rnd) { let u = 0; for (let i = 0; i < 4; i++) u += rnd(); return (u - 2) / 0.58; }

const PT_VERT = /* glsl */`
#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec3 color; attribute float size;
uniform float uGain, uPx, uMinPx, uMaxPx, uScale; varying vec3 vC;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float ps = size * uScale * uPx / -mv.z;
  float clampPs = clamp(ps, uMinPx * uPx, uMaxPx * uPx);
  // 小于最小像素时用亮度补偿，保持能量守恒
  float energy = ps < uMinPx * uPx ? (ps * ps) / (uMinPx * uMinPx * uPx * uPx) : 1.0;
  vC = color * uGain * max(energy, 0.015);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clampPs;
  #include <logdepthbuf_vertex>
}`;
const PT_FRAG = /* glsl */`
#include <common>
#include <logdepthbuf_pars_fragment>
varying vec3 vC;
void main(){
  #include <logdepthbuf_fragment>
  vec2 p = gl_PointCoord * 2.0 - 1.0; float r = dot(p, p); if (r > 1.0) discard;
  gl_FragColor = vec4(vC * exp(-r * 3.5), 1.0);
}`;
function pointsMat(blending = THREE.AdditiveBlending) {
  return new THREE.ShaderMaterial({ uniforms: { uGain: { value: 1 }, uPx: { value: 1 }, uMinPx: { value: 1.2 }, uMaxPx: { value: 40 }, uScale: { value: 300 } }, vertexShader: PT_VERT, fragmentShader: PT_FRAG, transparent: true, depthWrite: false, blending });
}

export class GalaxyWorld {
  constructor(tex) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.001, 3e6);
    this.bloom = { strength: 0.9, radius: 0.7, threshold: 0.7 };
    this.minDist = 0.5; this.maxDist = 250000;
    const S = this.scene;
    this.sky = skyDome(tex.milkyway, 2e5); this.sky.rotation.set(0, Math.PI, 0); S.add(this.sky);
    let seed = 42; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    this.rnd = rnd;

    // —— 银河 ——
    this.gal = new THREE.Group(); S.add(this.gal);
    const N = 360000;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N);
    let k = 0;
    const put = (x, y, z, r, g, b, s) => { pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; col[k * 3] = r; col[k * 3 + 1] = g; col[k * 3 + 2] = b; size[k] = s; k++; };
    // 核球 + 棒
    const barA = 0.45;
    for (let i = 0; i < 70000; i++) {
      const r = Math.pow(rnd(), 1.8) * 6500;
      const th = rnd() * Math.PI * 2, ph = Math.acos(rnd() * 2 - 1);
      let x = r * Math.sin(ph) * Math.cos(th) * 1.7, z = r * Math.sin(ph) * Math.sin(th) * 0.75, y = r * Math.cos(ph) * 0.45;
      const cx = x * Math.cos(barA) - z * Math.sin(barA), cz = x * Math.sin(barA) + z * Math.cos(barA);
      const w = 0.7 + rnd() * 0.6;
      put(cx, y, cz, 1.0 * w, 0.78 * w, 0.52 * w, 60 + rnd() * 120);
    }
    // 旋臂
    const arms = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
    this.armAt = (r, i) => arms[i] + Math.log(r / R0) / Math.tan(PITCH);
    for (let i = 0; i < 210000; i++) {
      const a = i % 4;
      const r = R0 + Math.pow(rnd(), 0.9) * 46000;
      const th = this.armAt(r, a) + gauss(rnd) * (0.16 + r / 160000);
      const spread = gauss(rnd) * (500 + r * 0.02);
      const x = Math.cos(th) * r + Math.cos(th + 1.57) * spread * 0.3, z = Math.sin(th) * r + Math.sin(th + 1.57) * spread * 0.3;
      const y = gauss(rnd) * (90 + r * 0.004);
      const young = rnd();
      if (young < 0.55) { const w = 0.5 + rnd() * 0.8; put(x, y, z, 0.62 * w, 0.75 * w, 1.0 * w, 40 + rnd() * 90); }
      else if (young < 0.62) { put(x, y, z, 1.6, 0.42, 0.75, 120 + rnd() * 260); }          // HII 区
      else { const w = 0.35 + rnd() * 0.5; put(x, y, z, 1.0 * w, 0.85 * w, 0.68 * w, 40 + rnd() * 70); }
    }
    // 盘面背景老年星
    for (let i = 0; i < 70000; i++) {
      const r = Math.pow(rnd(), 0.7) * 52000, th = rnd() * Math.PI * 2;
      const w = 0.25 + rnd() * 0.35;
      put(Math.cos(th) * r, gauss(rnd) * 300, Math.sin(th) * r, w, w * 0.88, w * 0.74, 40 + rnd() * 50);
    }
    // 球状星团
    for (let c = 0; c < 40; c++) {
      const r = 8000 + rnd() * 40000, th = rnd() * Math.PI * 2, ph = (rnd() - .5) * 2.2;
      const cx = Math.cos(th) * Math.cos(ph) * r, cy = Math.sin(ph) * r * 0.6, cz = Math.sin(th) * Math.cos(ph) * r;
      for (let j = 0; j < 220 && k < N; j++) put(cx + gauss(rnd) * 120, cy + gauss(rnd) * 120, cz + gauss(rnd) * 120, 1.0, 0.86, 0.66, 30);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, k * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(col.subarray(0, k * 3), 3));
    g.setAttribute('size', new THREE.BufferAttribute(size.subarray(0, k), 1));
    this.galMat = pointsMat(); this.galPts = new THREE.Points(g, this.galMat); this.galPts.frustumCulled = false; this.gal.add(this.galPts);
    // 尘埃带：沿旋臂内侧的暗色颗粒（正常混合）
    const ND = 60000, dp = new Float32Array(ND * 3), dc = new Float32Array(ND * 3), ds = new Float32Array(ND);
    for (let i = 0; i < ND; i++) {
      const a = i % 4, r = R0 + 1500 + Math.pow(rnd(), 0.9) * 38000;
      const th = this.armAt(r, a) - 0.12 + gauss(rnd) * 0.06;
      dp.set([Math.cos(th) * r, gauss(rnd) * 60, Math.sin(th) * r], i * 3);
      dc.set([0.04, 0.03, 0.025], i * 3); ds[i] = 300 + rnd() * 500;
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(dp, 3)); dg.setAttribute('color', new THREE.BufferAttribute(dc, 3)); dg.setAttribute('size', new THREE.BufferAttribute(ds, 1));
    this.dustMat = new THREE.ShaderMaterial({
      uniforms: { uOp: { value: 0.5 }, uPx: { value: 1 }, uScale: { value: 300 } }, transparent: true, depthWrite: false,
      vertexShader: `#include <common>
        #include <logdepthbuf_pars_vertex>
        attribute float size; uniform float uPx, uScale; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(size * uScale * uPx / -mv.z, 0.0, 60.0 * uPx);
        #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <common>
        #include <logdepthbuf_pars_fragment>
        uniform float uOp; void main(){
        #include <logdepthbuf_fragment>
        vec2 p = gl_PointCoord * 2.0 - 1.0; float r = dot(p,p); if (r > 1.0) discard; gl_FragColor = vec4(0.03, 0.02, 0.02, uOp * (1.0 - r) * 0.35); }`,
    });
    this.dust = new THREE.Points(dg, this.dustMat); this.dust.frustumCulled = false; this.gal.add(this.dust);
    this.gal.add(this.dust);
    // 银心光晕
    this.core = glowSprite(new THREE.Color(1.6, 1.15, 0.75), 30000, { power: 2.4, opacity: 0.55 }); this.gal.add(this.core);

    // 太阳位置：两臂之间 + 猎户臂
    const thA = this.armAt(R_SUN, 0);
    const sunTh = thA + Math.PI / 4;
    const sunLocal = V(Math.cos(sunTh) * R_SUN, 18, Math.sin(sunTh) * R_SUN);
    this.gal.position.copy(sunLocal.clone().negate());
    this.gcWorld = this.gal.position.clone();
    // 猎户臂：一段短小旋臂
    const NO = 22000, op = new Float32Array(NO * 3), oc = new Float32Array(NO * 3), os = new Float32Array(NO);
    for (let i = 0; i < NO; i++) {
      const u = rnd() - 0.45, r = R_SUN + u * 9000;
      const th = sunTh + u * 0.42 + gauss(rnd) * 0.035;
      const w = 0.6 + rnd() * 0.9; const hii = rnd() < 0.06;
      op.set([Math.cos(th) * r - sunLocal.x, gauss(rnd) * 120, Math.sin(th) * r - sunLocal.z], i * 3);
      oc.set(hii ? [1.5, 0.45, 0.7] : [0.7 * w, 0.8 * w, 1.0 * w], i * 3);
      os[i] = hii ? 160 : 30 + rnd() * 60;
    }
    const og = new THREE.BufferGeometry();
    og.setAttribute('position', new THREE.BufferAttribute(op, 3)); og.setAttribute('color', new THREE.BufferAttribute(oc, 3)); og.setAttribute('size', new THREE.BufferAttribute(os, 1));
    this.orionMat = pointsMat(); this.orionMat.uniforms.uScale.value = 45; this.orion = new THREE.Points(og, this.orionMat); this.orion.frustumCulled = false; S.add(this.orion);

    // —— 太阳邻域 ——
    // 100 光年内：HYG 真实星表（位置、B−V 颜色、绝对星等）；100–400 光年：程序生成补足
    // 银道坐标 → 世界坐标：X 指向银心（gcWorld 方向），Z（银北极）→ 世界 +Y，Y（银经 90°）= up × X
    const gX = V(this.gcWorld.x, 0, this.gcWorld.z).normalize(), gY = V(gX.z, 0, -gX.x), gZ = V(0, 1, 0);
    this.galToWorld = (x, y, z) => gX.clone().multiplyScalar(x).addScaledVector(gY, y).addScaledVector(gZ, z);
    const NC = NEAR_STARS.length / 5, proxK = NEAR_NAMES['Proxima Centauri'];
    const NP = 4000, NL = NC + NP, lp = new Float32Array(NL * 3), lc = new Float32Array(NL * 3), ls = new Float32Array(NL);
    for (let i = 0; i < NC; i++) {
      const o = i * 5, w = this.galToWorld(NEAR_STARS[o], NEAR_STARS[o + 1], NEAR_STARS[o + 2]);
      lp.set([w.x, w.y, w.z], i * 3);
      const [r, g, b] = bvToRGB(NEAR_STARS[o + 3]);
      const lum = Math.pow(10, -0.4 * (NEAR_STARS[o + 4] - 4.83));        // 以太阳为 1 的光度
      const k = Math.min(2.6, Math.max(0.22, 0.75 + 0.42 * Math.log10(lum)));
      lc.set([r * k, g * k, b * k], i * 3);
      ls[i] = i === proxK ? 0 : Math.min(2.4, Math.max(0.5, 0.9 + 0.3 * Math.log10(lum)));   // 比邻星单独用光晕画
    }
    const tints = [[0.62, 0.74, 1.0], [0.9, 0.93, 1.0], [1, 0.95, 0.85], [1, 0.8, 0.6], [1, 0.62, 0.45]];
    for (let i = NC; i < NL; i++) {
      const r = 100 + Math.pow(rnd(), 0.6) * 300, th = rnd() * Math.PI * 2, ph = Math.acos(rnd() * 2 - 1);
      lp.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.6, r * Math.sin(ph) * Math.sin(th)], i * 3);
      const t = tints[(rnd() * tints.length) | 0], b = 0.4 + Math.pow(rnd(), 3) * 2;
      lc.set([t[0] * b, t[1] * b, t[2] * b], i * 3); ls[i] = 0.6 + rnd() * 1.4;
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(lp, 3)); lg.setAttribute('color', new THREE.BufferAttribute(lc, 3)); lg.setAttribute('size', new THREE.BufferAttribute(ls, 1));
    this.localMat = pointsMat(); this.localMat.uniforms.uMinPx.value = 1.5; this.localMat.uniforms.uMaxPx.value = 14;
    this.local = new THREE.Points(lg, this.localMat); this.local.frustumCulled = false; S.add(this.local);
    // 太阳、比邻星、航线
    this.sun = glowSprite(new THREE.Color(2.4, 2.0, 1.4), 1.2, { power: 3, opacity: 1 }); S.add(this.sun);
    // 比邻星：星表里的真实方向，距离按剧本统一为 4.2 光年（星表值 4.24）
    const pk = proxK * 5;
    this.acenPos = this.galToWorld(NEAR_STARS[pk], NEAR_STARS[pk + 1], NEAR_STARS[pk + 2]).normalize().multiplyScalar(4.2);
    this.acen = glowSprite(new THREE.Color(2.4, 1.3, 0.7), 1.0, { power: 3, opacity: 1 }); this.acen.position.copy(this.acenPos); S.add(this.acen);
    this.route = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), this.acenPos]), new THREE.LineBasicMaterial({ color: new THREE.Color(1.6, 1.8, 2.4), transparent: true, opacity: 0.9 }));
    S.add(this.route);
    // 航线：太阳 → 地球（实线，已走过）、地球 → 比邻星（虚线，前方）；地球位置每帧取 HUD 同一距离函数
    this.routeDash = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), this.acenPos.clone()]), new THREE.LineDashedMaterial({ color: 0x8fa8cc, dashSize: 0.2, gapSize: 0.2, transparent: true, opacity: 0.5 }));
    this.routeDash.computeLineDistances(); S.add(this.routeDash);
    this.routeDir = this.acenPos.clone().normalize();
    // 地球位置标记（小圆点 + 光晕）与文字
    this.earthDot = glowSprite(new THREE.Color(1.2, 1.8, 2.8), 0.12, { power: 2.4, opacity: 1 }); S.add(this.earthDot);
    this.sunLabel = makeLabel('太阳系', 'SOLAR SYSTEM', [-0.06, -0.12]); S.add(this.sunLabel);
    this.acenLabel = makeLabel('比邻星 · 4.2 光年', 'PROXIMA CENTAURI · 4.2 LY', [-0.05, 0.5], 'rgba(255,214,170,0.95)'); this.acenLabel.position.copy(this.acenPos); S.add(this.acenLabel);
    this.earthLabel = makeLabel('地球', 'EARTH', [-0.08, 1.12], 'rgba(170,215,255,0.98)', 0.85); S.add(this.earthLabel);
    // 本地泡
    this.bubble = new THREE.Mesh(new THREE.SphereGeometry(300, 64, 32), new THREE.ShaderMaterial({
      uniforms: { uOp: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `#include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
        #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <common>
        #include <logdepthbuf_pars_fragment>
        uniform float uOp; varying vec3 vN; varying vec3 vW; void main(){
        #include <logdepthbuf_fragment>
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(cameraPosition - vW))), 3.0); gl_FragColor = vec4(vec3(0.5, 0.35, 0.9) * f * uOp, 1.0); }`,
    }));
    this.bubble.scale.set(1, 0.7, 1.2); S.add(this.bubble);
    // 标记框（“你在这里”）
    // 屏幕上恒定大小的小定位环：本地泡 / 猎户臂直径约 3% 画面高（半径约 8 px，线宽约 1.8 px），
    // 银河全景直径约 2%（半径约 5.4 px，线宽约 1.7 px）；两段用不同内径，保持线宽而不变成细线或实心点
    this.ringGeoNear = new THREE.RingGeometry(0.78, 1, 64);
    this.ringGeoFar = new THREE.RingGeometry(0.68, 1, 64);
    this.marker = new THREE.Mesh(this.ringGeoNear, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.7, 2.2), transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    S.add(this.marker);
    this.state = {};
  }

  // 文字摆放：避开两侧仪表（960 宽时 275–685 px），三个标签互不重叠
  _placeLabels(E) {
    const cam = this.camera; cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    const px = (v) => { const p = v.clone().project(cam); return { x: (p.x + 1) * 480, y: (1 - p.y) * 270 }; };
    const S = px(V(0, 0, 0)), A = px(this.acenPos), Ep = px(E);
    const w = (sp) => sp.scale.x / LABEL_SY * LABEL_H_PX;   // 标签像素宽度（画布已按文字裁切）
    // 三点在屏幕上常挤在一起：比邻星标签放在点上方（靠右，超出右侧仪表则改为左对齐到点），
    // 太阳系与地球标签都放在点下方、分处两侧（地球在太阳哪边，地球标签就放哪边）
    this.acenLabel.center.set(A.x + w(this.acenLabel) > 685 ? 0.95 : 0.05, -0.3);
    const eRight = Ep.x >= S.x;
    let sunRight = !eRight; if (!sunRight && S.x - w(this.sunLabel) < 275) sunRight = true;
    this.sunLabel.center.set(sunRight ? -0.05 : 1.05, 1.1);
    let eR = eRight; if (eR && Ep.x + w(this.earthLabel) > 685) eR = false; if (eR === sunRight && Math.abs(Ep.x - S.x) < 60) eR = !sunRight;
    this.earthLabel.center.set(eR ? -0.05 : 1.05, 1.1);
  }

  // 镜头：连续拉远（对数）
  camDist(t) { const u = sstep(126, 151.5, t); return 7 * Math.pow(220000 / 7, Math.pow(u, 1.15)); }
  shot(t) {
    const d = this.camDist(t);
    const ld = Math.log10(d);
    const toGC = sstep(3.2, 4.7, ld);
    const target = this.gcWorld.clone().multiplyScalar(toGC);
    const elev = lerp(0.32, 1.0, sstep(1.5, 4.9, ld));
    const az = lerp(2.6, 3.6, sstep(126, 152, t)) + Math.PI * 0.25;
    const dir = V(Math.cos(az) * Math.cos(elev), Math.sin(elev), Math.sin(az) * Math.cos(elev));
    return { pos: target.clone().addScaledVector(dir, d), look: target, fov: 45 };
  }
  range(t) { return this.camDist(t) * 9.46e12; }

  update(t, dt, clock) {
    const cam = this.camera;
    const d = cam.position.distanceTo(this.gcWorld.clone().multiplyScalar(0)) || 10;
    const dc = cam.position.length();
    const ld = Math.log10(Math.max(dc, 1));
    // 天空全景只在太阳附近出现
    this.sky.material.uniforms.uExp.value = 1 - sstep(2.3, 3.2, ld);
    this.sky.visible = ld < 3.3;
    this.sky.position.copy(cam.position);
    // 近景：邻近恒星与航线
    const nearOp = 1 - sstep(1.6, 2.6, ld);
    this.route.material.opacity = nearOp; this.routeDash.material.opacity = nearOp * 0.6;
    // 地球在航线上的位置 = HUD「距太阳」（光年）
    const ly = Math.min(4.2, distAU(Math.max(126, t)) / AU_PER_LY), E = this.routeDir.clone().multiplyScalar(ly);
    { const a = this.route.geometry.attributes.position; a.setXYZ(1, E.x, E.y, E.z); a.needsUpdate = true; this.route.geometry.computeBoundingSphere(); }
    { const a = this.routeDash.geometry.attributes.position; a.setXYZ(0, E.x, E.y, E.z); a.needsUpdate = true; this.routeDash.geometry.computeBoundingSphere(); this.routeDash.computeLineDistances(); }
    this.earthDot.position.copy(E); this.earthDot.scale.setScalar(Math.max(0.08, dc * 0.018)); this.earthDot.material.uniforms.uOp.value = nearOp; this.earthDot.visible = nearOp > 0.01;
    this.earthLabel.position.copy(E); this.earthLabel.material.opacity = nearOp * 0.95; this.earthLabel.visible = nearOp > 0.01;
    this.acenLabel.material.opacity = nearOp * 0.95; this.acenLabel.visible = nearOp > 0.01;
    this.earthLy = ly;
    // 片头章节卡（126–130.5 s）期间不显示近景文字，之后淡入
    const lin = sstep(129.6, 130.6, t);
    this.earthLabel.material.opacity *= lin; this.acenLabel.material.opacity *= lin;
    this._placeLabels(E);
    this.acen.visible = this.sun.visible = ld < 3.0;
    const sc = Math.max(0.3, dc * 0.025);
    this.sun.scale.setScalar(sc); this.acen.scale.setScalar(sc * 0.85);
    this.localMat.uniforms.uGain.value = 1 - sstep(2.8, 3.6, ld);
    this.localMat.uniforms.uScale.value = 30;
    this.bubble.material.uniforms.uOp.value = sstep(1.8, 2.4, ld) * (1 - sstep(2.9, 3.3, ld)) * 0.35;
    // 猎户臂与银河整体
    this.orionMat.uniforms.uGain.value = sstep(2.2, 3.0, ld) * (1 - sstep(4.3, 4.8, ld) * 0.6);
    this.galMat.uniforms.uGain.value = sstep(2.8, 3.8, ld) * lerp(1.0, 0.6, sstep(4.6, 5.3, ld));
    this.dustMat.uniforms.uOp.value = sstep(3.4, 4.2, ld);
    this.core.material.uniforms.uOp.value = sstep(3.5, 4.4, ld) * 0.55;
    // 标记：在太阳处画框
    this.marker.position.set(0, 0, 0); this.marker.lookAt(cam.position);
    const far = sstep(4.4, 4.6, ld), ringFrac = lerp(0.03, 0.02, far), tanH = Math.tan(cam.fov * Math.PI / 360);
    this.marker.geometry = far > 0.5 ? this.ringGeoFar : this.ringGeoNear;   // 切换处（ld 4.4–4.6）标记不可见
    this.marker.scale.setScalar(ringFrac * dc * tanH);   // 环半径 1 → 直径 = ringFrac × 画面高
    this.ringPx = ringFrac * 270;                          // 环半径（像素，按 540 高）
    // 本地泡 / 猎户臂（ld 2.0–4.4）标出太阳；银河全景（ld ≥ 4.6）再以较淡的框标出，便于在银盘里找到太阳系
    this.marker.material.opacity = sstep(2.0, 2.6, ld) * (1 - sstep(4.0, 4.4, ld)) * 0.8 + sstep(4.6, 4.9, ld) * 0.5;
    this.marker.visible = this.marker.material.opacity > 0.01;
    // 「太阳系」标签：近景随航线淡出，拉远后跟随太阳处的标记框淡入淡出（较暗）
    const mOp = this.marker.material.opacity / 0.8;
    this.sunLabel.material.opacity = Math.max(nearOp * 0.95, mOp * 0.7); this.sunLabel.visible = this.sunLabel.material.opacity > 0.01;
    this.sunLabel.material.opacity *= Math.max(sstep(129.6, 130.6, t), mOp > nearOp ? 1 : 0);
    if (mOp > nearOp) {
      const cam = this.camera; cam.updateMatrixWorld(); const q = V(0, 0, 0).project(cam), sx = (q.x + 1) * 480, lw = this.sunLabel.scale.x / LABEL_SY * LABEL_H_PX;
      const cy = -(this.ringPx + 3) / LABEL_H_PX;   // 标签底边在环顶之上约 3 px
      this.sunLabel.center.set(sx + lw > 685 ? 1.0 : 0.0, cy);   // 拉远时放在定位环正上方外侧（左缘对齐环心），超出右侧仪表则右缘对齐
      this.acenLabel.material.opacity *= 1 - mOp; this.earthLabel.material.opacity *= 1 - mOp;
    }
    // 银河缓慢自转（仅视觉）
    this.gal.rotation.y = 0;
    const px = renderer_px();
    for (const m of [this.galMat, this.orionMat, this.localMat]) m.uniforms.uPx.value = px;
    this.dustMat.uniforms.uPx.value = px;
    this.state = { ld };
  }

  destinations() {
    return [
      { name: '太阳系', en: 'SOL', get: () => ({ target: V(0, 0, 0), dist: 12 }) },
      { name: '比邻星', en: 'PROXIMA', get: () => ({ target: this.acenPos.clone(), dist: 3 }) },
      { name: '本地泡', en: 'LOCAL BUBBLE', get: () => ({ target: V(0, 0, 0), dist: 900 }) },
      { name: '猎户臂', en: 'ORION SPUR', get: () => ({ target: V(0, 0, 0), dist: 9000 }) },
      { name: '银河系全景', en: 'MILKY WAY', get: () => ({ target: this.gcWorld.clone(), dist: 110000 }) },
      { name: '银心', en: 'GALACTIC CORE', get: () => ({ target: this.gcWorld.clone(), dist: 14000 }) },
    ];
  }
}
function renderer_px() { return Math.min(window.devicePixelRatio || 1, 1.5); }

// B−V 色指数 → 近似 RGB（Ballesteros 2012 色温公式 + 简化黑体着色）
function bvToRGB(bv) {
  bv = Math.min(2.0, Math.max(-0.4, bv));
  const T = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
  const t = T / 100;
  let r, g, b;
  if (t <= 66) { r = 255; g = 99.47 * Math.log(t) - 161.12; b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04; }
  else { r = 329.7 * Math.pow(t - 60, -0.1332); g = 288.12 * Math.pow(t - 60, -0.0755); b = 255; }
  const c = (v) => Math.min(255, Math.max(0, v)) / 255;
  return [c(r), c(g), c(b)];
}
