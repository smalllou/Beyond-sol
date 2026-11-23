// 木星点火（电影版《流浪地球》）：洛希极限附近地球大气被潮汐拉成一道气柱流向木星，
// 领航员号沿气柱冲向木星、点燃氢氧混合气体，火焰在木星大气中扩散，冲击波掠过地球把它推出去。
// 全部以地球为原点（与 EarthWorld 一致）；时间均为影片时间 t（秒）。
import * as THREE from 'three';
import { NOISE, glowSprite } from './shaders.js';

const sstep = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const lerp = (a, b, u) => a + (b - a) * u;

// 时间表
// 电影：地面发动机（苏拉威西三号等）的等离子喷流射向两星之间的可燃混合气，差约五千公里够不着；
// 领航员号空间站冲进喷流顶端自爆，在两星夹缝中点燃混合气，火焰沿「脐带气流」烧向木星、引爆木星大气，冲击波把地球推开。
export const IGN = {
  plume0: 52.6, plume1: 55.0,      // 脐带气流形成
  beam0: 53.8,                     // 地面发动机喷流射向气流
  dive0: 54.9, fire: 55.9,         // 领航员号冲进喷流顶端 → 夹缝中点火
  uIgn: 0.3,                       // 点火点（沿气流，0 = 地球，1 = 木星）
  jup: 56.5,                       // 火焰烧到木星，木星大气被引爆
  shockHit: 57.1,                  // 冲击波到达地球
  end: 60.0,
};

const LOGV = '#include <common>\n#include <logdepthbuf_pars_vertex>\n';
const LOGF = '#include <common>\n#include <logdepthbuf_pars_fragment>\n';

export class JupiterIgnition {
  constructor(scene, RJ = 11.2) {
    this.RJ = RJ;
    this.group = new THREE.Group(); this.group.visible = false; scene.add(this.group);

    // 1) 气柱：粒子沿 地球表面 → 木星云顶 的弯曲流管流动
    const N = 14000, seed = new Float32Array(N * 4);
    let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < N; i++) {
      const r = Math.sqrt(-2 * Math.log(rnd() + 1e-6)) * 0.45, a = rnd() * Math.PI * 2;
      seed.set([rnd(), r * Math.cos(a), r * Math.sin(a), rnd()], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    this.plumeMat = new THREE.ShaderMaterial({
      uniforms: {
        uA: { value: new THREE.Vector3() }, uB: { value: new THREE.Vector3() }, uLag: { value: new THREE.Vector3() },
        uT1: { value: new THREE.Vector3() }, uT2: { value: new THREE.Vector3() },
        uTime: { value: 0 }, uGrow: { value: 0 }, uFJ: { value: 0 }, uFE: { value: 0 }, uIgn: { value: 0.3 }, uBurnT: { value: 0 }, uOp: { value: 1 }, uPx: { value: 540 },
      },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: LOGV + NOISE + /* glsl */`
        attribute vec4 aSeed;
        uniform vec3 uA, uB, uLag, uT1, uT2; uniform float uTime, uGrow, uFJ, uFE, uIgn, uBurnT, uOp, uPx;
        varying vec3 vCol; varying float vA;
        void main(){
          float u = fract(aSeed.x + uTime * 0.07);
          float w = mix(0.22, 1.9, pow(u, 1.25));
          vec3 base = mix(uA, uB, u) + uLag * sin(3.14159 * u) * (1.0 - 0.3 * u);
          float tw = (vnoise(vec3(u * 9.0 - uTime * 0.6, aSeed.yz * 2.0)) - 0.5) * 0.9;
          // 木星快速自转把气流拧成脐带：横截面随 u 旋转
          float th = u * 7.0 - uTime * 0.35; mat2 R = mat2(cos(th), -sin(th), sin(th), cos(th));
          vec2 q = R * vec2(aSeed.y + tw, aSeed.z - tw * 0.5);
          q.x *= 1.0 + 0.35 * sin(u * 11.0 + aSeed.w * 6.0);
          vec3 p = base + (uT1 * q.x + uT2 * q.y) * w;
          // 可见：气柱从地球一端逐渐伸长
          float vis = smoothstep(uGrow, uGrow - 0.06, u);
          // 点火：火焰前沿从木星一端（u = 1）向地球一端烧回
          // 点火：火焰自夹缝中的点火点向两端蔓延（向木星快，向地球慢）
          float dI = u - uIgn;
          float burn = dI >= 0.0 ? smoothstep(uFJ + 0.04, uFJ - 0.04, dI) : smoothstep(uFE + 0.03, uFE - 0.03, -dI);
          float age = clamp(abs(dI) * -1.5 + uBurnT * 0.35, 0.0, 1.0);
          // 点火前：被木星橙红色光照亮的气流（地球大气 + 冰屑），越靠近木星越浓、越红；少量冰屑偏冷白
          vec3 air = mix(vec3(1.25, 0.62, 0.26), vec3(1.6, 0.48, 0.14), u) * (0.55 + 0.45 * aSeed.w);
          air = mix(air, vec3(0.75, 0.8, 0.95), step(0.93, aSeed.w) * (1.0 - u));
          vec3 hot = mix(vec3(2.6, 1.45, 0.55), vec3(2.0, 0.6, 0.12), age);
          hot = mix(hot, vec3(0.6, 0.12, 0.03), smoothstep(0.55, 1.0, age));
          vCol = mix(air, hot, burn);
          float dens = exp(-dot(aSeed.yz, aSeed.yz) * 1.6);
          vA = vis * uOp * mix(0.2 * mix(1.0, 0.55, u), 0.18, burn) * (0.4 + 0.6 * dens) * (1.0 - burn * smoothstep(0.75, 1.0, age) * 0.85);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (0.05 + 0.09 * aSeed.w) * w * (1.0 + burn * 0.8) * uPx / max(-mv.z, 0.1);
          gl_Position = projectionMatrix * mv;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: LOGF + /* glsl */`
        varying vec3 vCol; varying float vA;
        void main(){
          #include <logdepthbuf_fragment>
          vec2 c = gl_PointCoord * 2.0 - 1.0; float r = dot(c, c); if (r > 1.0) discard;
          gl_FragColor = vec4(vCol * vA * exp(-r * 2.5), 1.0);
        }`,
    });
    this.plume = new THREE.Points(g, this.plumeMat); this.plume.frustumCulled = false; this.group.add(this.plume);

    // 2) 木星大气燃烧：贴着云顶的一层壳，以点火点为中心的火圈向外扩张
    this.capMat = new THREE.ShaderMaterial({
      uniforms: { uDir: { value: new THREE.Vector3(1, 0, 0) }, uAng: { value: 0 }, uTime: { value: 0 }, uOp: { value: 0 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: LOGV + /* glsl */`
        varying vec3 vN, vW; varying vec3 vV;
        void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = position;
          vV = normalize(cameraPosition - w.xyz);
          gl_Position = projectionMatrix * viewMatrix * w;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: LOGF + NOISE + /* glsl */`
        uniform vec3 uDir; uniform float uAng, uTime, uOp; varying vec3 vN, vW, vV;
        void main(){
          #include <logdepthbuf_fragment>
          float a = acos(clamp(dot(normalize(vN), uDir), -1.0, 1.0));
          float n = fbm(vW * 0.55 + vec3(0.0, uTime * 0.25, 0.0));
          float n2 = fbm(vW * 1.6 - vec3(uTime * 0.4));
          float edge = uAng + (n - 0.5) * 0.22;
          float ring = exp(-pow((a - edge) / 0.045, 2.0));
          float inside = smoothstep(edge + 0.02, edge - 0.08, a);
          float core = exp(-a * a / max(uAng * uAng * 0.25, 1e-4));
          vec3 col = vec3(3.0, 1.6, 0.55) * ring * (0.6 + 0.8 * n2)
                   + vec3(1.9, 0.55, 0.12) * inside * (0.25 + 0.75 * n * n2) * 0.9
                   + vec3(2.4, 1.2, 0.4) * core * 0.45;
          float limb = 0.35 + 0.65 * pow(clamp(dot(normalize(vN), vV), 0.0, 1.0), 0.4);
          gl_FragColor = vec4(col * uOp * limb, 1.0);
        }`,
    });
    this.cap = new THREE.Mesh(new THREE.SphereGeometry(RJ * 1.006, 160, 80), this.capMat); this.group.add(this.cap);

    // 3) 火球：点火点处隆起的蘑菇状火球（一半埋在木星里，被深度遮住）
    this.ballMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOp: { value: 0 }, uAge: { value: 0 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: LOGV + NOISE + /* glsl */`
        uniform float uTime; varying vec3 vP, vN, vV;
        void main(){ vP = position; vec3 p = position * (1.0 + (fbm(position * 2.2 + uTime * 0.5) - 0.5) * 0.35);
          vec4 w = modelMatrix * vec4(p, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz);
          gl_Position = projectionMatrix * viewMatrix * w;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: LOGF + NOISE + /* glsl */`
        uniform float uTime, uOp, uAge; varying vec3 vP, vN, vV;
        void main(){
          #include <logdepthbuf_fragment>
          float f = clamp(dot(normalize(vN), vV), 0.0, 1.0);
          float n = fbm(vP * 3.0 + vec3(0.0, -uTime * 0.8, 0.0));
          vec3 hot = mix(vec3(2.6, 1.5, 0.6), vec3(2.2, 0.7, 0.15), smoothstep(0.0, 0.5, uAge));
          hot = mix(hot, vec3(1.1, 0.25, 0.06), smoothstep(0.5, 1.0, uAge));
          float body = pow(f, 0.6) * (0.2 + 0.6 * n);
          float rim = pow(1.0 - f, 3.0) * 0.6;
          gl_FragColor = vec4(hot * (body + rim) * uOp, 1.0);
        }`,
    });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), this.ballMat); this.group.add(this.ball);

    // 4) 冲击波：自点火点扩张的薄壳，只画轮廓
    this.shockMat = new THREE.ShaderMaterial({
      uniforms: { uOp: { value: 0 }, uTime: { value: 0 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: LOGV + /* glsl */`
        varying vec3 vN, vV, vP;
        void main(){ vP = position; vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz);
          gl_Position = projectionMatrix * viewMatrix * w;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: LOGF + NOISE + /* glsl */`
        uniform float uOp, uTime; varying vec3 vN, vV, vP;
        void main(){
          #include <logdepthbuf_fragment>
          float f = abs(dot(normalize(vN), vV));
          float n = fbm(vP * 4.0 + uTime * 0.7);
          float rim = pow(1.0 - f, 4.0) * (0.4 + 1.2 * n) * 0.6;
          vec3 col = mix(vec3(2.6, 1.1, 0.3), vec3(3.0, 2.2, 1.2), pow(1.0 - f, 10.0));
          gl_FragColor = vec4(col * rim * uOp, 1.0);
        }`,
    });
    this.shock = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), this.shockMat); this.group.add(this.shock);

    // 5) 点火闪光 + 领航员号（一颗沿气柱冲向木星的蓝白光点）
    this.flash = glowSprite(new THREE.Color(2.6, 2.0, 1.4), 1, { power: 2.2, opacity: 0 }); this.group.add(this.flash);
    this.nav = glowSprite(new THREE.Color(0.8, 1.0, 2.4), 1, { power: 3.0, opacity: 0 }); this.group.add(this.nav);
    this.dir0 = null;
    // 6) 地面发动机喷流：三道蓝白等离子束从地球朝木星一侧射向气流，顶端差一截够不着点火点
    this.beamMat = new THREE.ShaderMaterial({
      uniforms: { uOp: { value: 0 }, uTime: { value: 0 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: LOGV + `
        varying vec2 vUv; varying vec3 vN, vV;
        void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz);
          gl_Position = projectionMatrix * viewMatrix * w;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: LOGF + `
        uniform float uOp, uTime; varying vec2 vUv; varying vec3 vN, vV;
        void main(){
          #include <logdepthbuf_fragment>
          float f = abs(dot(normalize(vN), vV));
          float core = pow(f, 3.0);
          float along = vUv.y;                                  // 0 = 地面，1 = 顶端
          float tip = smoothstep(1.0, 0.8, along);
          float flick = 0.85 + 0.15 * sin(along * 60.0 - uTime * 40.0);
          vec3 col = mix(vec3(0.35, 0.6, 1.8), vec3(1.2, 1.6, 2.6), core);
          gl_FragColor = vec4(col * (0.2 + 0.6 * core) * tip * flick * uOp, 1.0);
        }`,
    });
    this.beams = [];
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.022, 1, 16, 1, true), this.beamMat); b.geometry.translate(0, 0.5, 0); this.group.add(b); this.beams.push(b); }
    this.ignGlow = glowSprite(new THREE.Color(2.4, 0.9, 0.25), 1, { power: 2.0, opacity: 0 }); this.group.add(this.ignGlow);
  }

  // J：木星中心（相对地球），vel：地球相对木星的运动方向，nrm：轨道面法向，jf：木星可见度
  update(t, clock, J, vel, nrm, jf, camera, pxH) {
    const on = t >= IGN.plume0 && t < IGN.end && jf > 0.001;
    this.group.visible = on; if (!on) return;
    const RJ = this.RJ, dJ = J.clone().normalize();
    const A = dJ.clone().multiplyScalar(1.04);
    const B = J.clone().addScaledVector(dJ, -RJ * 0.98);
    const T1 = dJ.clone().cross(nrm).normalize(), T2 = T1.clone().cross(dJ).normalize();
    const P = this.plumeMat.uniforms, lag = vel.clone().multiplyScalar(-1.6);
    P.uA.value.copy(A); P.uB.value.copy(B); P.uT1.value.copy(T1); P.uT2.value.copy(T2); P.uLag.value.copy(lag);
    P.uTime.value = clock; P.uPx.value = pxH; P.uIgn.value = IGN.uIgn;
    P.uGrow.value = lerp(0, 1.08, sstep(IGN.plume0, IGN.plume1, t));
    const fired = t >= IGN.fire, age = Math.max(0, t - IGN.fire);
    P.uFJ.value = fired ? (1 - IGN.uIgn + 0.05) * sstep(IGN.fire, IGN.jup, t) : -1;
    P.uFE.value = fired ? (IGN.uIgn - 0.06) * sstep(IGN.fire, IGN.fire + 1.6, t) : -1;
    P.uBurnT.value = age;
    P.uOp.value = jf * (1 - sstep(58.6, 59.8, t) * 0.7);
    const along = (u) => A.clone().lerp(B, u).addScaledVector(lag, Math.sin(Math.PI * u) * (1 - 0.3 * u));
    const ign = along(IGN.uIgn);

    // 地面发动机喷流（点火后被火焰吞没、随即熄灭）
    const bo = jf * sstep(IGN.beam0, IGN.beam0 + 0.6, t) * (1 - sstep(IGN.fire + 0.2, IGN.fire + 0.9, t));
    this.beamMat.uniforms.uOp.value = bo; this.beamMat.uniforms.uTime.value = clock;
    const top = along(IGN.uIgn - 0.07);
    [[0.0, 0.0], [0.28, 0.12], [-0.22, 0.2]].forEach(([a, b], i) => {
      const bm = this.beams[i]; bm.visible = bo > 0.001; if (!bm.visible) return;
      const base = dJ.clone().addScaledVector(T1, a).addScaledVector(T2, b).normalize().multiplyScalar(1.0);
      const tipP = top.clone().addScaledVector(T1, a * 0.6).addScaledVector(T2, b * 0.6);
      const d = tipP.clone().sub(base), L = d.length() * lerp(0.2, 1, sstep(IGN.beam0, IGN.beam0 + 1.2, t));
      bm.position.copy(base); bm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); bm.scale.set(1, L, 1);
    });

    // 领航员号：从侧上方冲进喷流顶端
    this.nav.visible = t >= IGN.dive0 && t < IGN.fire + 0.03;
    if (this.nav.visible) {
      const u = Math.pow(sstep(IGN.dive0, IGN.fire, t), 1.4);
      const start = ign.clone().addScaledVector(T2, 2.2).addScaledVector(vel, 1.2);
      this.nav.position.copy(start.lerp(ign, u)); this.nav.scale.setScalar(0.7);
      this.nav.material.uniforms.uOp.value = jf * (0.8 + 0.2 * Math.sin(clock * 30));
    }
    // 夹缝中的点火：强闪光 + 一团持续燃烧的火光
    const fl = fired ? Math.exp(-age / 0.25) : 0;
    this.flash.position.copy(ign); this.flash.scale.setScalar(lerp(2, 10, Math.min(1, age * 4)));
    this.flash.material.uniforms.uOp.value = jf * fl * 0.7;
    this.ignGlow.position.copy(ign); this.ignGlow.scale.setScalar(lerp(1, 5, Math.min(1, age)));
    this.ignGlow.material.uniforms.uOp.value = fired ? jf * 0.3 * Math.exp(-age / 2.0) : 0;

    // 木星大气被引爆：点火点固定在火焰到达木星时的木星 → 地球方向
    const jOn = t >= IGN.jup, jAge = Math.max(0, t - IGN.jup);
    if (!this.dir0 || !jOn) this.dir0 = dJ.clone().negate();
    const imp = J.clone().addScaledVector(this.dir0, RJ);
    this.cap.position.copy(J); this.cap.visible = jOn;
    const C = this.capMat.uniforms; C.uDir.value.copy(this.dir0); C.uTime.value = clock;
    C.uAng.value = 0.05 + 1.25 * (1 - Math.exp(-jAge / 1.6));
    C.uOp.value = jf * sstep(IGN.jup, IGN.jup + 0.3, t) * (1 - 0.4 * sstep(57.8, 59.8, t));
    this.ball.visible = jOn; this.ball.position.copy(imp);
    this.ball.scale.setScalar(lerp(0.5, 7.5, 1 - Math.exp(-jAge / 1.0)));
    const Bm = this.ballMat.uniforms; Bm.uTime.value = clock; Bm.uAge.value = Math.min(1, jAge / 3.2);
    Bm.uOp.value = jf * sstep(IGN.jup, IGN.jup + 0.15, t) * (1 - 0.6 * sstep(58.0, 59.8, t));

    // 冲击波：火焰壁自木星点火点扩张，shockHit 时刻扫过地球
    const Rs = imp.length() * jAge / (IGN.shockHit - IGN.jup);
    this.shock.visible = jOn && Rs > 0.2;
    this.shock.position.copy(imp); this.shock.scale.setScalar(Math.max(Rs, 0.01));
    this.shockMat.uniforms.uTime.value = clock;
    this.shockMat.uniforms.uOp.value = jf * sstep(IGN.jup, IGN.jup + 0.2, t) * (1 - sstep(IGN.shockHit + 0.05, IGN.shockHit + 0.7, t));
  }


  // 冲击波过境时的镜头抖动
  shake(t) {
    const k = sstep(IGN.shockHit - 0.05, IGN.shockHit + 0.1, t) * (1 - sstep(IGN.shockHit + 0.2, IGN.shockHit + 1.5, t));
    if (k <= 0) return new THREE.Vector3();
    const f = (a) => Math.sin(t * a) * Math.sin(t * a * 0.37 + 1.3);
    return new THREE.Vector3(f(71), f(53), f(89)).multiplyScalar(0.2 * k);
  }
}
