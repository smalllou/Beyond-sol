// 硬表面拼装建模：用几百个基元拼出舰船、空间站、攀爬舱，按材质合并成少量 draw call。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

let _tex = null;
export function hullTextures() {
  if (_tex) return _tex;
  const S = 1024;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const e = document.createElement('canvas'); e.width = e.height = S;
  const g = c.getContext('2d'), ge = e.getContext('2d');
  g.fillStyle = '#8b939e'; g.fillRect(0, 0, S, S);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, S, S);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // 面板分割
  for (let i = 0; i < 900; i++) {
    const w = 16 + rnd() * 120, h = 8 + rnd() * 70, x = rnd() * S, y = rnd() * S;
    const v = 110 + rnd() * 70 | 0;
    g.fillStyle = `rgb(${v},${v + 4},${v + 10})`;
    g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(30,34,40,.55)'; g.lineWidth = 1.2; g.strokeRect(x, y, w, h);
  }
  // 暗色凹槽与管线
  for (let i = 0; i < 140; i++) {
    g.fillStyle = 'rgba(20,24,30,.7)';
    if (rnd() < .5) g.fillRect(0, rnd() * S, S, 2 + rnd() * 3); else g.fillRect(rnd() * S, 0, 2 + rnd() * 3, S);
  }
  // 窗户带（自发光）
  for (let row = 0; row < 26; row++) {
    const y = rnd() * S, on = rnd();
    for (let x = 0; x < S; x += 7) {
      if (rnd() < 0.62 * on) {
        g.fillStyle = '#1b2230'; g.fillRect(x, y, 4, 3);
        const warm = rnd() < 0.7;
        ge.fillStyle = warm ? `rgba(255,${190 + rnd() * 50 | 0},120,1)` : 'rgba(170,215,255,1)';
        ge.fillRect(x, y, 4, 3);
      }
    }
  }
  // 航行灯
  for (let i = 0; i < 40; i++) { ge.fillStyle = rnd() < .5 ? '#ff4a3a' : '#8fd0ff'; ge.fillRect(rnd() * S, rnd() * S, 3, 3); }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  const emi = new THREE.CanvasTexture(e); emi.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, emi]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
  _tex = { map, emi };
  return _tex;
}

export function materials() {
  const { map, emi } = hullTextures();
  return {
    hull: new THREE.MeshStandardMaterial({ map, emissiveMap: emi, emissive: 0xffffff, emissiveIntensity: 2.2, metalness: 0.55, roughness: 0.48 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x23272e, metalness: 0.7, roughness: 0.55, map }),
    white: new THREE.MeshStandardMaterial({ color: 0xdde3ea, metalness: 0.2, roughness: 0.6, map, emissiveMap: emi, emissive: 0xffffff, emissiveIntensity: 1.6 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc89b4a, metalness: 0.9, roughness: 0.35 }),
    glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.0, 2.6) }),
    blue: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 2.2, 4.0) }),
    red: new THREE.MeshBasicMaterial({ color: new THREE.Color(4.0, 0.5, 0.35) }),
    panel: new THREE.MeshStandardMaterial({ color: 0x1d3157, metalness: 0.4, roughness: 0.3, emissive: 0x0a1a3a, emissiveIntensity: 0.6 }),
  };
}

export class Kit {
  constructor() { this.parts = {}; }
  _push(mat, geo) { (this.parts[mat] ||= []).push(geo); return geo; }
  _place(geo, p, r, s) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...(p || [0, 0, 0])),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(r || [0, 0, 0]))),
      new THREE.Vector3(...(s || [1, 1, 1])));
    geo.applyMatrix4(m);
    return geo;
  }
  box(mat, size, p, r) { const g = new THREE.BoxGeometry(...size); this._uv(g, size); return this._push(mat, this._place(g, p, r)); }
  cyl(mat, rt, rb, h, p, r, seg = 20, open = false) { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open); this._uvScale(g, Math.max(rt, rb) * 6, h * 2); return this._push(mat, this._place(g, p, r)); }
  torus(mat, R, t, p, r, seg = 96, arc = Math.PI * 2) { const g = new THREE.TorusGeometry(R, t, 10, seg, arc); this._uvScale(g, R * 8, 1); return this._push(mat, this._place(g, p, r)); }
  sphere(mat, rad, p, s) { const g = new THREE.SphereGeometry(rad, 20, 14); return this._push(mat, this._place(g, p, null, s)); }
  lathe(mat, pts, p, r, seg = 32) { const g = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg); return this._push(mat, this._place(g, p, r)); }
  geo(mat, g, p, r, s) { return this._push(mat, this._place(g, p, r, s)); }
  _uv(g, size) { const uv = g.attributes.uv; const k = Math.max(...size) * 1.6; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k + Math.random(), uv.getY(i) * k * 0.5 + Math.random()); }
  _uvScale(g, a, b) { const uv = g.attributes.uv; const o = Math.random(); for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * a + o, uv.getY(i) * b + o); }
  build(mats) {
    const grp = new THREE.Group();
    for (const [k, list] of Object.entries(this.parts)) {
      const norm = list.map(g => { const n = g.index ? g.toNonIndexed() : g; for (const a of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(a)) n.deleteAttribute(a); return n; });
      const merged = mergeGeometries(norm, false);
      const m = new THREE.Mesh(merged, mats[k]);
      grp.add(m);
    }
    return grp;
  }
}

// —— 具体资产 ——

// 领航员号旗舰：长脊、环形居住段、推进段
export function buildFlagship(mats) {
  const k = new Kit();
  const L = 1.0;
  k.cyl('hull', 0.035, 0.035, L, [0, 0, 0], [0, 0, Math.PI / 2], 16);
  for (let i = 0; i < 9; i++) {
    const x = -0.42 + i * 0.1;
    k.box(i % 2 ? 'hull' : 'white', [0.07, 0.09 + (i % 3) * 0.02, 0.09], [x, 0, 0]);
    k.box('dark', [0.02, 0.13, 0.03], [x + 0.04, 0, 0]);
  }
  // 舰首
  k.lathe('white', [[0, 0], [0.05, 0.02], [0.065, 0.1], [0.06, 0.16], [0.04, 0.2], [0.0, 0.22]], [0.5, 0, 0], [0, 0, -Math.PI / 2]);
  // 环形居住段
  k.torus('hull', 0.2, 0.018, [0.12, 0, 0], [0, Math.PI / 2, 0], 80);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; k.box('dark', [0.012, 0.012, 0.2], [0.12, Math.sin(a) * 0.1, Math.cos(a) * 0.1], [a, 0, 0]); }
  // 太阳能/散热翼
  for (const s of [-1, 1]) { k.box('panel', [0.32, 0.004, 0.14], [-0.15, 0, s * 0.14]); k.box('dark', [0.32, 0.01, 0.01], [-0.15, 0, s * 0.075]); }
  // 推进段
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; k.cyl('dark', 0.03, 0.045, 0.12, [-0.56, Math.sin(a) * 0.06, Math.cos(a) * 0.06], [0, 0, Math.PI / 2], 16); }
  k.box('red', [0.01, 0.01, 0.01], [0.3, 0.06, 0]);
  return k.build(mats);
}

export function buildEscort(mats, seed = 1) {
  const k = new Kit();
  const L = 0.4 + (seed % 3) * 0.1;
  k.cyl('hull', 0.02, 0.026, L, [0, 0, 0], [0, 0, Math.PI / 2], 10);
  k.box('white', [L * 0.5, 0.05, 0.05], [L * 0.1, 0, 0]);
  k.lathe('white', [[0, 0], [0.03, 0.02], [0.03, 0.06], [0, 0.1]], [L / 2, 0, 0], [0, 0, -Math.PI / 2], 12);
  k.cyl('dark', 0.02, 0.03, 0.06, [-L / 2 - 0.02, 0, 0], [0, 0, Math.PI / 2], 12);
  if (seed % 2) for (const s of [-1, 1]) k.box('panel', [0.12, 0.003, 0.07], [0, 0, s * 0.06]);
  return k.build(mats);
}

// 巨型环形舰（第四章掠过）
export function buildRingShip(mats) {
  const k = new Kit();
  k.torus('hull', 1.0, 0.06, [0, 0, 0], [0, 0, 0], 160);
  k.torus('gold', 1.0, 0.065, [0, 0, 0.05], [0, 0, 0], 160, Math.PI * 2);
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * Math.PI * 2;
    k.box(i % 2 ? 'white' : 'hull', [0.09, 0.12, 0.16], [Math.cos(a) * 1.0, Math.sin(a) * 1.0, 0], [0, 0, a]);
  }
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; k.box('dark', [0.02, 1.0, 0.02], [Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0], [0, 0, a - Math.PI / 2]); }
  k.cyl('hull', 0.1, 0.1, 0.3, [0, 0, 0], [Math.PI / 2, 0, 0], 20);
  return k.build(mats);
}

// 天枢站：中心枢纽 + 双反向旋转环
export function buildTianshu(mats) {
  const hub = new Kit();
  hub.cyl('hull', 0.05, 0.05, 0.5, [0, 0, 0], null, 24);
  hub.cyl('white', 0.08, 0.08, 0.08, [0, 0.12, 0], null, 24);
  hub.cyl('white', 0.08, 0.08, 0.08, [0, -0.12, 0], null, 24);
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; hub.box('dark', [0.28, 0.02, 0.02], [Math.cos(a) * 0.14, 0.24, Math.sin(a) * 0.14], [0, -a, 0]); hub.box('glow', [0.01, 0.01, 0.01], [Math.cos(a) * 0.28, 0.24, Math.sin(a) * 0.28]); }
  for (const s of [-1, 1]) hub.box('panel', [0.5, 0.004, 0.16], [s * 0.36, -0.3, 0]);
  const hubG = hub.build(mats);
  const ring = (R, y) => {
    const k = new Kit();
    k.torus('hull', R, 0.03, [0, y, 0], [Math.PI / 2, 0, 0], 120);
    for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; k.box(i % 3 ? 'hull' : 'white', [0.07, 0.06, 0.09], [Math.cos(a) * R, y, Math.sin(a) * R], [0, -a, 0]); }
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; k.box('dark', [R, 0.012, 0.012], [Math.cos(a) * R / 2, y, Math.sin(a) * R / 2], [0, -a, 0]); }
    return k.build(mats);
  };
  const r1 = ring(0.42, 0.12), r2 = ring(0.42, -0.12);
  const g = new THREE.Group(); g.add(hubG, r1, r2);
  g.userData.rings = [r1, r2];
  return g;
}

// 电梯攀爬舱
export function buildClimber(mats) {
  const k = new Kit();
  k.cyl('white', 0.05, 0.05, 0.16, [0, 0, 0], null, 6);
  for (let i = 0; i < 3; i++) k.box('hull', [0.13, 0.03, 0.13], [0, -0.06 + i * 0.06, 0], [0, i * 0.4, 0]);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; k.box('glow', [0.006, 0.006, 0.006], [Math.cos(a) * 0.07, 0.085, Math.sin(a) * 0.07]); }
  k.box('red', [0.008, 0.008, 0.008], [0, 0.1, 0]);
  return k.build(mats);
}

// 电梯缆绳桁架（沿 +Y）
export function buildTruss(mats, length, width = 0.012, seg = 0.03) {
  const k = new Kit();
  const n = Math.floor(length / seg);
  const r = width;
  const corners = [0, 1, 2].map(i => { const a = i / 3 * Math.PI * 2; return [Math.cos(a) * r, Math.sin(a) * r]; });
  for (const [x, z] of corners) k.cyl('dark', 0.0016, 0.0016, length, [x, length / 2, z], null, 4);
  const dl = Math.hypot(seg, r * 1.732);
  for (let i = 0; i < n; i++) {
    const y = i * seg;
    for (let c = 0; c < 3; c++) {
      const [x0, z0] = corners[c], [x1, z1] = corners[(c + 1) % 3];
      const mid = [(x0 + x1) / 2, y + seg / 2, (z0 + z1) / 2];
      const g = new THREE.CylinderGeometry(0.0008, 0.0008, dl, 3);
      const dir = new THREE.Vector3(x1 - x0, seg, z1 - z0).normalize();
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
      g.translate(...mid);
      k.geo('hull', g);
    }
    if (i % 40 === 0) k.box('glow', [0.004, 0.004, 0.004], [corners[0][0], y, corners[0][1]]);
  }
  return k.build(mats);
}
