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

// 领航员国际空间站（《流浪地球》）：单座空间站，按片中镜头与官方 MENG MMS-002 模型还原。
// 局部 +X 为船头。前端：巨型辐条轮（方截面格栅桁架外缘 + 三道同心桁架环 + 自行车式交叉密辐条 + 内环舱段模块）；
// 紧随大轮之后是一道粗大的分节亮窗居住环，与大轮同轴、都垂直于主脊；
// 主脊：一串粗方盒格栅舱段；尾部：推进段，8 根向后掠的尖刺肋。整体深枪灰色钢结构，窗光暖黄。
// M：{ hull, dark, steel, warm, lamp, red }
export function buildNavigator(M) {
  const g = new THREE.Group();
  const add = (parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m;
  };
  const Y = new THREE.Vector3(0, 1, 0);
  const strut = (parent, p0, p1, r, mat, seg = 4) => {
    const d = new THREE.Vector3().subVectors(p1, p0), len = d.length();
    const geo = new THREE.CylinderGeometry(r, r, len, seg);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, d.normalize()));
    geo.translate((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2);
    parent.add(new THREE.Mesh(geo, mat));
  };
  // 合并成每种材质一个网格；坐标相对 grp 自身（不含 grp 的变换）
  const bake = (grp) => {
    const inv = new THREE.Matrix4().copy(grp.matrixWorld).invert();
    grp.updateMatrixWorld(true);
    const rel = new THREE.Matrix4(), by = new Map();
    const inv2 = new THREE.Matrix4().copy(grp.matrixWorld).invert();
    grp.traverse((o) => { if (!o.isMesh) return; rel.multiplyMatrices(inv2, o.matrixWorld); const q = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(rel); for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv'].includes(k)) q.deleteAttribute(k); (by.get(o.material) || by.set(o.material, []).get(o.material)).push(q); });
    const out = new THREE.Group();
    for (const [mat, list] of by) out.add(new THREE.Mesh(mergeGeometries(list, false), mat));
    return out;
  };
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const dots = (list, mat, size) => {
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(size, size, size), mat, list.length), m4 = new THREE.Matrix4();
    list.forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); im.setMatrixAt(i, m4); });
    return im;
  };
  // 在 YZ 平面（法线 = X）上的点
  const Q = (r, a, x) => new THREE.Vector3(x, Math.cos(a) * r, Math.sin(a) * r);
  // 方截面格栅环：四道弦杆 + 每格竖撑、外面/前后面 X 斜撑
  const lattice = (parent, r, depth, width, n, rail, brace, matRail, matBrace) => {
    const ri = r - depth / 2, ro = r + depth / 2, xf = width / 2, xb = -width / 2;
    for (const [rr, xx] of [[ri, xf], [ri, xb], [ro, xf], [ro, xb]]) add(parent, new THREE.TorusGeometry(rr, rail, 5, Math.max(64, n * 2)), matRail, xx, 0, 0, 0, Math.PI / 2);
    for (let k = 0; k < n; k++) {
      const a0 = k / n * Math.PI * 2, a1 = (k + 1) / n * Math.PI * 2;
      strut(parent, Q(ri, a0, xf), Q(ro, a0, xf), brace, matBrace); strut(parent, Q(ri, a0, xb), Q(ro, a0, xb), brace, matBrace);
      strut(parent, Q(ro, a0, xf), Q(ro, a0, xb), brace, matBrace); strut(parent, Q(ri, a0, xf), Q(ri, a0, xb), brace, matBrace);
      strut(parent, Q(ro, a0, xf), Q(ro, a1, xb), brace * 0.8, matBrace); strut(parent, Q(ro, a0, xb), Q(ro, a1, xf), brace * 0.8, matBrace);
      strut(parent, Q(ri, a0, xf), Q(ro, a1, xf), brace * 0.8, matBrace); strut(parent, Q(ri, a0, xb), Q(ro, a1, xb), brace * 0.8, matBrace);
    }
  };
  // —— 1. 前端巨型辐条轮
  const wheel = new THREE.Group();
  const RW = 0.27;
  // 片中大轮比亮窗环小一圈，内部是密集的深色同心桁架层
  lattice(wheel, RW, 0.03, 0.06, 110, 0.003, 0.001, M.hull, M.dark);
  lattice(wheel, 0.225, 0.025, 0.05, 90, 0.0025, 0.0009, M.dark, M.dark);
  lattice(wheel, 0.18, 0.025, 0.055, 76, 0.0025, 0.0009, M.hull, M.dark);
  lattice(wheel, 0.135, 0.022, 0.05, 60, 0.0025, 0.0009, M.dark, M.dark);
  add(wheel, new THREE.TorusGeometry(0.085, 0.016, 8, 64), M.dark, 0, 0, 0, 0, Math.PI / 2);   // 内圈实体舱环
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; const p = Q(0.085, a, 0); add(wheel, new THREE.BoxGeometry(0.03, 0.028, 0.03), k % 3 ? M.dark : M.hull, p.x, p.y, p.z, a); }
  // 环间嵌板（深色，部分扇区），让轮面显得密实
  for (const [r0, r1] of [[0.1, 0.122], [0.148, 0.167], [0.193, 0.212], [0.238, 0.255]]) for (let k = 0; k < 40; k++) {
    if (rnd() < 0.45) continue; const a = (k + 0.5) / 40 * Math.PI * 2, p = Q((r0 + r1) / 2, a, (rnd() - 0.5) * 0.02);
    add(wheel, new THREE.BoxGeometry(0.01 + rnd() * 0.02, r1 - r0, 2 * Math.PI * (r0 + r1) / 2 / 40 * 0.8), rnd() < 0.7 ? M.dark : M.hull, p.x, p.y, p.z, a);
  }
  // 外缘设备舱
  for (let k = 0; k < 36; k++) { const a = k / 36 * Math.PI * 2 + rnd() * 0.05, p = Q(RW + 0.01, a, 0); if (rnd() < 0.4) continue; add(wheel, new THREE.BoxGeometry(0.05 + rnd() * 0.03, 0.018, 0.022 + rnd() * 0.015), M.dark, p.x, p.y, p.z, a); }
  // 自行车式交叉辐条
  for (let k = 0; k < 96; k++) {
    const a = k / 96 * Math.PI * 2, side = k % 2 ? 1 : -1;
    strut(wheel, Q(0.085, a + side * 0.35, side * 0.025), Q(RW - 0.016, a, side * 0.025), 0.0006, M.hull, 3);
  }
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; strut(wheel, Q(0.035, a, 0), Q(RW - 0.015, a, 0), 0.0035, M.dark); }    // 主辐梁
  add(wheel, new THREE.CylinderGeometry(0.035, 0.04, 0.05, 16), M.dark, 0, 0, 0, 0, 0, Math.PI / 2);
  // 轮内暖色灯点（舱室窗光）
  const wl = []; for (let i = 0; i < 160; i++) { const rr = [0.085, 0.135, 0.18, 0.225][i % 4] + (rnd() - 0.5) * 0.02, a = rnd() * Math.PI * 2; wl.push(Q(rr, a, (rnd() - 0.5) * 0.04)); }
  wheel.add(dots(wl, M.warm, 0.004));
  wheel.updateMatrixWorld(true);
  const wheelB = bake(wheel); wheelB.add(wheel.children.find(c => c.isInstancedMesh));
  const spinW = new THREE.Group(); spinW.position.x = 0.4; spinW.add(wheelB); g.add(spinW);

  // —— 2. 亮窗居住环：粗方截面、分节，与大轮成约 65°
  const hab = new THREE.Group();
  const RH = 0.33, NSEG = 40;
  for (let k = 0; k < NSEG; k++) {
    const a = (k + 0.5) / NSEG * Math.PI * 2, len = 2 * Math.PI * RH / NSEG;
    const p = new THREE.Vector3(0, Math.cos(a) * RH, Math.sin(a) * RH);
    add(hab, new THREE.BoxGeometry(0.05, 0.042, len * 0.86), M.hull, p.x, p.y, p.z, a);
    add(hab, new THREE.BoxGeometry(0.056, 0.048, len * 0.12), M.dark, p.x, p.y, p.z, a + Math.PI / NSEG);
  }
  for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + Math.PI / 4; strut(hab, new THREE.Vector3(0, Math.cos(a) * 0.05, Math.sin(a) * 0.05), new THREE.Vector3(0, Math.cos(a) * (RH - 0.02), Math.sin(a) * (RH - 0.02)), 0.005, M.dark); }
  add(hab, new THREE.TorusGeometry(0.05, 0.012, 8, 32), M.dark, 0, 0, 0, 0, Math.PI / 2);
  hab.updateMatrixWorld(true);
  const habB = bake(hab);
  const hw = [];
  for (let k = 0; k < NSEG * 7; k++) { const a = (k + 0.5) / (NSEG * 7) * Math.PI * 2; if (k % 7 === 6 || rnd() < 0.12) continue; for (const sx of [0.026, -0.026]) hw.push(new THREE.Vector3(sx, Math.cos(a) * RH, Math.sin(a) * RH)); for (const rr of [RH + 0.022, RH - 0.022]) if (rnd() < 0.6) hw.push(new THREE.Vector3(0, Math.cos(a) * rr, Math.sin(a) * rr)); }
  habB.add(dots(hw, M.warm, 0.0042));
  const spinH = new THREE.Group(); spinH.add(habB);
  const tiltH = new THREE.Group(); tiltH.position.x = 0.2; tiltH.rotation.z = 0; tiltH.add(spinH); g.add(tiltH);

  // —— 3. 主脊：粗方盒格栅舱段
  const st = new THREE.Group();
  add(st, new THREE.CylinderGeometry(0.018, 0.018, 0.86, 10), M.dark, -0.04, 0, 0, 0, 0, Math.PI / 2);
  for (let i = 0; i < 6; i++) {
    const x = -0.26 + i * 0.085, s = 0.085 + (i % 2) * 0.012;
    add(st, new THREE.BoxGeometry(0.07, s, s), i % 2 ? M.dark : M.hull, x, 0, 0);
    for (const [cy, cz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {      // 盒角格栅
      const h = s / 2 + 0.006;
      strut(st, new THREE.Vector3(x - 0.04, cy * h, cz * h), new THREE.Vector3(x + 0.04, cy * h, cz * h), 0.0025, M.steel);
      strut(st, new THREE.Vector3(x - 0.04, cy * h, cz * h), new THREE.Vector3(x + 0.04, -cy * h, cz * h), 0.0012, M.steel);
    }
  }
  add(st, new THREE.BoxGeometry(0.06, 0.02, 0.02), M.dark, 0.0, 0.07, 0);                     // 运输艇对接臂
  add(st, new THREE.ConeGeometry(0.013, 0.045, 8), M.steel, 0.035, 0.085, 0, 0, 0, -Math.PI / 2);
  // —— 4. 推进段：粗筒 + 向后掠的尖刺肋 + 喷口
  add(st, new THREE.CylinderGeometry(0.06, 0.075, 0.16, 20), M.hull, -0.39, 0, 0, 0, 0, Math.PI / 2);
  add(st, new THREE.TorusGeometry(0.075, 0.01, 6, 32), M.dark, -0.35, 0, 0, 0, Math.PI / 2);
  add(st, new THREE.CylinderGeometry(0.06, 0.04, 0.05, 20, 1, true), M.dark, -0.49, 0, 0, 0, 0, Math.PI / 2);
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2, long = k % 2 === 0;
    const p0 = Q(0.07, a, -0.38), p1 = Q(long ? 0.24 : 0.16, a, long ? -0.43 : -0.41);
    const d = new THREE.Vector3().subVectors(p1, p0), len = d.length();
    const cone = new THREE.ConeGeometry(0.014, len, 4); cone.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, d.normalize())); cone.translate((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2);
    st.add(new THREE.Mesh(cone, M.hull));
    strut(st, Q(0.075, a, -0.46), p1, 0.003, M.dark);
  }
  st.updateMatrixWorld(true);
  g.add(bake(st));
  // 航行灯
  g.add(dots([Q(0.2, 0, -0.5), Q(0.2, Math.PI, -0.5), Q(RW + 0.02, Math.PI / 2, 0.38)], M.red, 0.006));
  g.add(dots([Q(RW + 0.02, 0, 0.38), Q(RW + 0.02, Math.PI, 0.38), Q(RW + 0.02, -Math.PI / 2, 0.38)], M.lamp, 0.008));
  g.userData.spin = [[spinW, 0.05], [spinH, -0.1]];      // 绕各自局部 X 轴
  return g;
}

// 方舟号国际空间站（《流浪地球2》）：在太空电梯同步轨道船坞里建造的巨型圆盘。
// 按片中“方舟国际空间站[在建]”镜头还原：电梯缆索从圆心穿过；同心圆环桁架一层层向外抬高成浅碗（梯田状）；
// 环间铺铜褐色舱壁板（在建，留有缺口露出桁架）；最外圈白色厚环挂满舱段模块与太阳翼；一段弧形运输轨道架在外缘上方。
// 以“站体单位”建模（外环半径 12.5），外层整体缩放到原站尺寸（0.42）。三向投影贴图按站体单位取样。
// M：{ hull, dark, white, gold, copper, panel, warm, lamp, red }
export function buildArk(M) {
  const add = (parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m;
  };
  const bake = (grp) => {
    grp.updateMatrixWorld(true);
    const by = new Map();
    grp.traverse((o) => { if (!o.isMesh) return; const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); (by.get(o.material) || by.set(o.material, []).get(o.material)).push(g); });
    const out = new THREE.Group();
    for (const [mat, list] of by) out.add(new THREE.Mesh(mergeGeometries(list, false), mat));
    return out;
  };
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // 两点之间的细杆（桁架弦杆/斜撑）
  const Y = new THREE.Vector3(0, 1, 0);
  const strut = (parent, p0, p1, r, mat) => {
    const d = new THREE.Vector3().subVectors(p1, p0), len = d.length();
    const g = new THREE.CylinderGeometry(r, r, len, 5);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, d.normalize()));
    g.translate((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2);
    parent.add(new THREE.Mesh(g, mat));
  };
  const P = (r, a, y) => new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
  const st = new THREE.Group();
  // 梯田：半径越大越高（浅碗口朝上，缆索从下方进入圆心）
  const RINGS = [2.2, 3.8, 5.4, 7.0, 8.6, 10.2, 11.6, 12.5];
  const hY = (r) => 0.09 * r * r / 12.5 * 4.0 - 0.6;
  const NS = 48;                                   // 径向分格数
  RINGS.forEach((r, i) => {
    const y = hY(r), outer = i === RINGS.length - 1, tube = outer ? 0.42 : 0.12 + i * 0.015;
    // 每圈双层弦杆（上下两道环），中间竖撑+斜撑形成环形桁架
    add(st, new THREE.TorusGeometry(r, tube, outer ? 14 : 6, 200), outer ? M.white : M.hull, 0, y, 0, Math.PI / 2);
    if (!outer) add(st, new THREE.TorusGeometry(r, tube * 0.7, 5, 200), M.dark, 0, y - 0.55, 0, Math.PI / 2);
    if (!outer) for (let k = 0; k < NS; k++) {
      const a0 = k / NS * Math.PI * 2, a1 = (k + 1) / NS * Math.PI * 2;
      strut(st, P(r, a0, y), P(r, a0, y - 0.55), 0.035, M.dark);
      strut(st, P(r, a0, y), P(r, a1, y - 0.55), 0.025, M.dark);
    }
    // 台阶面：环与内一圈之间的铜褐色舱壁（在建，部分扇区空着）
    if (i > 0) {
      const r0 = RINGS[i - 1], y0 = hY(r0);
      for (let k = 0; k < NS; k++) {
        const a0 = k / NS * Math.PI * 2, a1 = (k + 1) / NS * Math.PI * 2;
        // 径向桁梁
        if (k % 2 === 0) { strut(st, P(r0, a0, y0), P(r, a0, y), 0.05, M.hull); strut(st, P(r0, a0, y0 - 0.5), P(r, a0, y - 0.5), 0.03, M.dark); }
        if (rnd() < 0.3 + i * 0.04) continue;          // 未完工的缺口
        const g = new THREE.BufferGeometry();
        const q = [P(r0 + 0.12, a0 + 0.004, y0 - 0.08), P(r - 0.12, a0 + 0.004, y - 0.08), P(r - 0.12, a1 - 0.004, y - 0.08), P(r0 + 0.12, a1 - 0.004, y0 - 0.08)];
        const v = []; for (const t of [0, 1, 2, 0, 2, 3]) v.push(q[t].x, q[t].y, q[t].z);
        for (const t of [0, 2, 1, 0, 3, 2]) v.push(q[t].x, q[t].y - 0.06, q[t].z);    // 背面
        g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
        g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(v.length / 3 * 2).fill(0), 2));
        st.add(new THREE.Mesh(g, rnd() < 0.18 ? M.white : M.copper));
      }
    }
  });
  // 外环：舱段模块、径向太阳翼、对接臂
  const R = 12.5, yR = hY(R);
  for (let k = 0; k < 64; k++) {
    const a = k / 64 * Math.PI * 2;
    const h = 0.5 + rnd() * 0.7;
    add(st, new THREE.BoxGeometry(0.9 + rnd() * 0.6, h, 1.1), k % 5 ? M.white : M.hull, Math.cos(a) * R, yR + 0.35 + h / 2, Math.sin(a) * R, 0, -a, 0);
    if (k % 3 === 0) add(st, new THREE.BoxGeometry(0.6, 0.5, 0.8), M.dark, Math.cos(a) * (R + 0.6), yR - 0.2, Math.sin(a) * (R + 0.6), 0, -a, 0);
  }
  for (let k = 0; k < 10; k++) {
    const a = (k + 0.5) / 10 * Math.PI * 2;
    const w = new THREE.Group(); w.position.set(Math.cos(a) * (R + 0.5), yR, Math.sin(a) * (R + 0.5)); w.rotation.y = -a; st.add(w);
    add(w, new THREE.BoxGeometry(4.5, 0.1, 0.1), M.dark, 2.25, 0, 0);
    for (let j = 0; j < 2; j++) add(w, new THREE.BoxGeometry(1.9, 0.04, 1.3), M.gold, 1.2 + j * 2.1, 0, 0);   // 片中太阳翼是金棕色
  }
  // 弧形运输轨道：架在外缘上方约 140°，带支架与车厢
  const arc = Math.PI * 0.8, a0 = Math.PI * 0.15, rT = 13.6, yT = yR + 2.2;
  add(st, new THREE.TorusGeometry(rT, 0.38, 10, 120, arc), M.white, 0, yT, 0, Math.PI / 2, 0, a0);
  add(st, new THREE.TorusGeometry(rT, 0.16, 6, 120, arc), M.dark, 0, yT + 0.45, 0, Math.PI / 2, 0, a0);
  for (let k = 0; k <= 10; k++) { const a = -(a0 + arc * k / 10); strut(st, P(rT, a, yT), P(R, a, yR + 0.3), 0.12, M.hull); }
  for (let k = 0; k < 3; k++) { const a = -(a0 + arc * (0.2 + k * 0.3)); add(st, new THREE.BoxGeometry(1.0, 0.8, 2.2), M.white, Math.cos(a) * rT, yT + 0.7, Math.sin(a) * rT, 0, -a, 0); }
  // 中心枢纽：缆索穿过的锚定井，上下夹持环
  add(st, new THREE.CylinderGeometry(1.1, 1.4, 3.2, 24, 1, true), M.hull, 0, -1.2, 0);
  for (const y of [-2.6, -1.2, 0.2]) add(st, new THREE.TorusGeometry(1.35, 0.14, 8, 40), M.dark, 0, y, 0, Math.PI / 2);
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; strut(st, P(1.3, a, -2.6), P(RINGS[0], a, hY(RINGS[0])), 0.09, M.hull); }
  const inner = new THREE.Group();
  inner.add(bake(st));
  // 窗光：沿外环与台阶内壁的暖色点，在建区稀疏
  const win = [];
  for (let i = 0; i < 260; i++) { const ri = 1 + (rnd() * (RINGS.length - 1) | 0), r = RINGS[ri], a = rnd() * Math.PI * 2; win.push(P(r + (ri === RINGS.length - 1 ? 0.45 : 0.05), a, hY(r) + (ri === RINGS.length - 1 ? 0.2 : -0.2))); }
  const dots = (list, mat, size) => {
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(size, size, size), mat, list.length), m4 = new THREE.Matrix4();
    list.forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); im.setMatrixAt(i, m4); });
    return im;
  };
  inner.add(dots(win, M.warm, 0.09));
  const lamps = []; for (let i = 0; i < 40; i++) { const a = rnd() * Math.PI * 2; lamps.push(P(R + 0.2, a, yR + 1.2)); }
  inner.add(dots(lamps, M.lamp, 0.07));
  inner.add(dots([0, 1, 2, 3, 4, 5].map(k => P(R + 5, (k + 0.5) / 6 * Math.PI * 2, yR)), M.red, 0.16));
  inner.scale.setScalar(0.42 / 12.5);
  const g = new THREE.Group(); g.add(inner);
  g.userData.rings = [];                // 片中方舟号是不旋转的船坞结构
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
