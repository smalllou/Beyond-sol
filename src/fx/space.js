// 深空环境：银河全景天空、点状星、速度流线、冰屑
import * as THREE from 'three';

export function skyDome(tex, radius = 9000) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: tex }, uExp: { value: 1.0 }, uTint: { value: new THREE.Color(1, 1, 1) }, uNeb: { value: 0 } },
    side: THREE.BackSide, depthWrite: false,
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv; varying vec3 vD;
      void main(){ vUv = uv; vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D uMap; uniform float uExp, uNeb; uniform vec3 uTint; varying vec2 vUv; varying vec3 vD;
      void main(){
        #include <logdepthbuf_fragment>
        vec3 c = texture2D(uMap, vUv).rgb;
        c = pow(c, vec3(1.25)) * 1.35;
        // 星云染色（日球层顶 / 星际介质）
        float band = exp(-pow(vD.y * 2.2 + 0.3, 2.0));
        c += uNeb * (vec3(0.55, 0.22, 0.6) * band + vec3(0.18, 0.1, 0.35) * (1.0 - band)) * 0.35;
        gl_FragColor = vec4(c * uTint * uExp, 1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 48), mat);
  m.renderOrder = -10;
  m.frustumCulled = false;
  return m;
}

export function starPoints(n = 14000, radius = 8000, seed = 3) {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
  const tints = [[0.62, 0.74, 1.0], [0.85, 0.9, 1.0], [1, 1, 1], [1, 0.93, 0.8], [1, 0.78, 0.55]];
  for (let i = 0; i < n; i++) {
    // 偏向银河带分布
    let v; const band = rnd() < 0.45;
    do { v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1); } while (v.lengthSq() > 1 || v.lengthSq() < 0.01);
    v.normalize(); if (band) { v.y *= 0.18; v.normalize(); }
    pos.set([v.x * radius, v.y * radius, v.z * radius], i * 3);
    const t = tints[(rnd() * tints.length) | 0];
    const b = Math.pow(rnd(), 6.0) * 3.2 + 0.25;
    col.set([t[0] * b, t[1] * b, t[2] * b], i * 3);
    size[i] = 1.0 + Math.pow(rnd(), 8) * 5;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uGain: { value: 1 }, uPx: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      attribute float size; attribute vec3 color; varying vec3 vC; uniform float uTime, uPx;
      void main(){ vC = color * (0.85 + 0.15 * sin(uTime * 2.0 + position.x)); vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size * uPx * 1.6;
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uGain; varying vec3 vC;
      void main(){
        #include <logdepthbuf_fragment>
        vec2 p = gl_PointCoord * 2.0 - 1.0; float r = dot(p,p); if (r > 1.0) discard; gl_FragColor = vec4(vC * exp(-r * 4.0) * uGain, 1.0); }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false; pts.renderOrder = -9;
  return pts;
}

// 速度流线：在相机周围的体积内循环流动
export function streaks(n = 1400, { span = 30, len = 1.2, color = new THREE.Color(0.5, 0.7, 1.4) } = {}) {
  const base = new THREE.PlaneGeometry(1, 1);
  base.translate(0, 0.5, 0);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index; g.setAttribute('position', base.attributes.position);
  const a = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) a.set([(Math.random() - .5) * span, (Math.random() - .5) * span, (Math.random() - .5) * span, Math.random()], i * 4);
  g.setAttribute('aP', new THREE.InstancedBufferAttribute(a, 4));
  g.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uDir: { value: new THREE.Vector3(0, 0, -1) }, uSpeed: { value: 10 }, uSpan: { value: span }, uLen: { value: len }, uCol: { value: color }, uOp: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uWidth: { value: 0.012 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      attribute vec4 aP; uniform float uTime, uSpeed, uSpan, uLen, uWidth; uniform vec3 uDir, uCenter; varying float vY; varying float vS;
      void main(){
        vec3 d = normalize(uDir);
        vec3 p = aP.xyz + d * (uTime * uSpeed * (0.6 + aP.w * 0.8));
        p = mod(p + uSpan * 0.5, uSpan) - uSpan * 0.5;
        p += uCenter;
        vec3 toCam = normalize(cameraPosition - p);
        vec3 side = normalize(cross(d, toCam) + 1e-5);
        float L = uLen * (0.4 + aP.w);
        vec3 w = p + d * position.y * L + side * position.x * uWidth * (0.5 + aP.w);
        vY = position.y; vS = aP.w;
        float edge = 1.0 - smoothstep(uSpan * 0.32, uSpan * 0.5, length(p - uCenter));
        vS *= edge;
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uCol; uniform float uOp; varying float vY; varying float vS;
      void main(){
        #include <logdepthbuf_fragment>
        float a = (1.0 - vY) * vY * 4.0; gl_FragColor = vec4(uCol * a * uOp * (0.4 + vS), 1.0); }`,
  });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false;
  return m;
}

// 冰屑 / 柯伊伯带碎块
export function shards(n = 900, span = 40) {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); v.multiplyScalar(0.7 + Math.random() * 0.5); p.setXYZ(i, v.x, v.y * 0.8, v.z); }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0x9fb0c4, roughness: 0.7, metalness: 0.05, flatShading: true, emissive: 0x0b1424 });
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.userData.items = [];
  for (let i = 0; i < n; i++) {
    m.userData.items.push({
      p: new THREE.Vector3((Math.random() - .5) * span, (Math.random() - .5) * span * 0.35, (Math.random() - .5) * span),
      s: 0.015 + Math.pow(Math.random(), 4) * 0.22,
      r: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      w: new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(0.6),
    });
  }
  m.userData.span = span;
  m.frustumCulled = false;
  return m;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _v = new THREE.Vector3();
export function updateShards(m, t, flow, keepOut = 1.25) {
  const span = m.userData.span;
  m.userData.items.forEach((it, i) => {
    _v.copy(it.p).addScaledVector(flow, t);
    _v.x = ((_v.x + span / 2) % span + span) % span - span / 2;
    _v.y = ((_v.y + span * 0.175) % (span * 0.35) + span * 0.35) % (span * 0.35) - span * 0.175;
    _v.z = ((_v.z + span / 2) % span + span) % span - span / 2;
    let sc = it.s;
    const d = _v.length(); if (d < keepOut) sc *= Math.max(0, (d - keepOut * 0.9) / (keepOut * 0.1));
    _e.set(it.r.x + it.w.x * t, it.r.y + it.w.y * t, it.r.z + it.w.z * t);
    _q.setFromEuler(_e); _s.setScalar(Math.max(sc, 0.0001));
    _m.compose(_v, _q, _s); m.setMatrixAt(i, _m);
  });
  m.instanceMatrix.needsUpdate = true;
}
