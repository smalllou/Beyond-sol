// L0 地球世界：1 单位 = 地球半径 6371 km。地球位于原点。
import * as THREE from 'three';
import { Plumes } from '../fx/plumes.js';
import { earthMaterial, cloudMaterial, atmosphereMaterial, planetMaterial, glowSprite, NOISE } from '../fx/shaders.js';
import { skyDome, starPoints, streaks, shards, updateShards } from '../fx/space.js';
import { materials, buildFlagship, buildEscort, buildRingShip, buildTianshu, buildClimber, buildTruss } from '../fx/kit.js';
import { keyed } from '../story.js';

const D2R = Math.PI / 180;
export const lonlat = (lon, lat, r = 1) => new THREE.Vector3(Math.cos(lat * D2R) * Math.cos(lon * D2R) * r, Math.sin(lat * D2R) * r, -Math.cos(lat * D2R) * Math.sin(lon * D2R) * r);
const sstep = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const lerp = (a, b, u) => a + (b - a) * u;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const HERO = { lon: 104, lat: 31 };       // 重型阵列（四川盆地附近）
const ANCHOR = { lon: 103.8, lat: 0 };    // 电梯赤道锚点（新加坡以南海上平台）
const GEO = 6.62;

function landMask(img) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0, 1024, 512);
  const d = g.getImageData(0, 0, 1024, 512).data;
  return (lon, lat) => {
    const u = ((lon + 180) / 360) % 1, v = (90 - lat) / 180;
    const x = Math.min(1023, Math.max(0, (u * 1024) | 0)), y = Math.min(511, Math.max(0, (v * 512) | 0));
    return d[(y * 1024 + x) * 4] < 90; // 镜面贴图：海洋亮，陆地暗
  };
}

export class EarthWorld {
  constructor(tex) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.0005, 20000);
    this.bloom = { strength: 0.75, radius: 0.5, threshold: 0.86 };
    this.minDist = 0.03; this.maxDist = 60;
    const S = this.scene;
    this.mats = materials();

    // 天空
    this.sky = skyDome(tex.milkyway); this.sky.rotation.set(0.5, 2.2, 1.05); S.add(this.sky);
    this.stars = starPoints(12000, 8000); this.stars.rotation.copy(this.sky.rotation); S.add(this.stars);

    // 光照
    this.sunDir = V(0.75, 0.32, 0.58).normalize();
    this.sunLight = new THREE.DirectionalLight(0xfff3e6, 2.4); S.add(this.sunLight);
    this.fill = new THREE.HemisphereLight(0x4060a0, 0x080a10, 0.18); S.add(this.fill);
    this.plumeLight = new THREE.PointLight(0x8a7bff, 0, 3, 1.5); S.add(this.plumeLight);

    // 地球
    this.earth = new THREE.Group(); S.add(this.earth);
    this.earthMat = earthMaterial(tex);
    const eg = new THREE.SphereGeometry(1, 320, 160);
    this.earthMesh = new THREE.Mesh(eg, this.earthMat); this.earth.add(this.earthMesh);
    this.cloudMat = cloudMaterial(tex);
    this.clouds = new THREE.Mesh(new THREE.SphereGeometry(1.0065, 256, 128), this.cloudMat); this.earth.add(this.clouds);
    this.atmoMat = atmosphereMaterial(new THREE.Color(0.28, 0.55, 1.0), 2.6, 1.5);
    this.atmo = new THREE.Mesh(new THREE.SphereGeometry(1.045, 128, 64), this.atmoMat); S.add(this.atmo);

    this._buildEngines(tex);
    this._buildElevator();
    this._buildFleet();
    this._buildPlanets(tex);
    this._buildInterstellar();
    this.state = {};
  }

  _buildEngines(tex) {
    const land = landMask(tex.earth_spec.image);
    const heroV = lonlat(HERO.lon, HERO.lat);
    this.heroV = heroV;
    // 主发动机网络：背阳半球的陆地上
    const P = this.plumes = new Plumes(9000, { core: 0xf8f4ff, edge: 0x6a4dff, alt: 0x3f8dff, gain: 1.15, grow: 2.2 });
    let s = 11; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const bodies = [];
    let tries = 0;
    while (P.n < 6400 && tries++ < 400000) {
      const lon = rnd() * 360 - 180, lat = Math.asin(rnd() * 2 - 1) / D2R;
      const v = lonlat(lon, lat);
      const ang = v.angleTo(heroV);
      if (ang > 1.65 || ang < 0.2) continue;
      if (!land(lon, lat)) continue;
      if (Math.abs(lat) > 72) continue;
      const tilt = V(rnd() - .5, rnd() - .5, rnd() - .5).multiplyScalar(0.08);
      const dir = v.clone().add(tilt).normalize();
      const len = 0.16 + Math.pow(rnd(), 2.2) * 0.42;
      P.add(v.clone().multiplyScalar(1.004), dir, len, 0.0026 + rnd() * 0.0024, ang * 7.0 + rnd() * 1.2, rnd());
      if (rnd() < 0.08) bodies.push(v);
    }
    // 重型阵列：25 台大发动机围成同心圆
    this.heroStart = P.n;
    const T = V(0, 1, 0).cross(heroV).normalize(), B = heroV.clone().cross(T);
    const heroPts = [];
    for (let ring = 0; ring < 3; ring++) {
      const cnt = [1, 8, 16][ring], r = [0, 0.018, 0.036][ring];
      for (let i = 0; i < cnt; i++) {
        const a = i / cnt * Math.PI * 2 + ring * 0.3;
        const p = heroV.clone().addScaledVector(T, Math.cos(a) * r).addScaledVector(B, Math.sin(a) * r).normalize();
        heroPts.push(p);
        P.add(p.clone().multiplyScalar(1.012), p.clone(), 0.75 + rnd() * 0.25, 0.011, rnd() * 0.6, 0.2);
      }
    }
    // 赤道转向阵列：沿赤道一圈，喷流沿切向
    this.steerStart = P.n;
    for (let i = 0; i < 180; i++) {
      const lon = i * 2;
      const v = lonlat(lon, 0);
      const tan = V(0, 1, 0).cross(v).normalize();
      const dir = v.clone().multiplyScalar(0.55).add(tan.multiplyScalar(-0.85)).normalize();
      P.add(v.clone().multiplyScalar(1.006), dir, 0.18 + rnd() * 0.06, 0.006, 9 + (i % 30) * 0.12, 0.9);
    }
    P.commit();
    this.earth.add(P.mesh);
    P.mesh.renderOrder = 5;

    // 发动机实体（只在近景可见）
    const tower = new THREE.LatheGeometry([
      [0.0, 0], [0.0062, 0], [0.006, 0.002], [0.0042, 0.003], [0.0036, 0.009], [0.003, 0.0105], [0.0034, 0.0125], [0.0046, 0.0145], [0.0052, 0.016], [0.0049, 0.0162], [0.0, 0.0162]
    ].map(([x, y]) => new THREE.Vector2(x, y)), 24);
    const mk = (pts, scale) => {
      const im = new THREE.InstancedMesh(tower, this.mats.white, pts.length);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion();
      pts.forEach((p, i) => { q.setFromUnitVectors(V(0, 1, 0), p); m.compose(p.clone().multiplyScalar(0.9995), q, V(scale, scale, scale)); im.setMatrixAt(i, m); });
      return im;
    };
    this.earth.add(mk(heroPts, 2.4));
    this.earth.add(mk(bodies, 0.6));
    // 重型阵列底座：导流环与灯带
    const ringG = new THREE.RingGeometry(0.046, 0.05, 96);
    const ring = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.4, 0.7), side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
    ring.position.copy(heroV.clone().multiplyScalar(1.0015)); ring.lookAt(heroV.clone().multiplyScalar(2)); this.earth.add(ring);
    this.heroRing = ring;
    // 地表光晕
    this.heroGlow = glowSprite(new THREE.Color(0.7, 0.6, 1.6), 0.16, { power: 3.0, opacity: 0 });
    this.heroGlow.position.copy(heroV.clone().multiplyScalar(1.03)); this.earth.add(this.heroGlow);
  }

  _buildElevator() {
    const a = lonlat(ANCHOR.lon, ANCHOR.lat);
    this.anchorV = a;
    const grp = new THREE.Group();
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), a);
    grp.quaternion.copy(q); grp.position.copy(a);
    this.earth.add(grp);
    this.elev = grp;
    const L = GEO - 1;
    grp.add(buildTruss(this.mats, L, 0.010, 0.028));
    // 远景可见的缆绳辉光
    const lineG = new THREE.CylinderGeometry(0.0012, 0.0012, L, 6, 1, true); lineG.translate(0, L / 2, 0);
    grp.add(new THREE.Mesh(lineG, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 1.1, 1.6), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })));
    // 锚点平台
    const base = new THREE.Group();
    const pf = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.006, 32), this.mats.hull); base.add(pf);
    const pr = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.0015, 8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 1.5, 0.6) })); pr.rotation.x = Math.PI / 2; base.add(pr);
    grp.add(base);
    // 中继站
    for (const h of [0.6, 1.6, 3.0]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.025, 12), this.mats.hull); w.position.y = h; grp.add(w); }
    // 攀爬舱
    this.climber = buildClimber(this.mats); this.climber.scale.setScalar(0.18); grp.add(this.climber);
    this.climberLight = glowSprite(new THREE.Color(1.6, 1.4, 1.1), 0.05, { power: 3 }); grp.add(this.climberLight);
    // 天枢站
    this.station = buildTianshu(this.mats); this.station.scale.setScalar(0.32); this.station.position.y = L; grp.add(this.station);
    // 同步轨道环（环绕整个地球）
    const geoRing = new THREE.Mesh(new THREE.TorusGeometry(GEO, 0.004, 6, 720), new THREE.MeshStandardMaterial({ color: 0x9aa4b0, metalness: 0.6, roughness: 0.4, emissive: 0x1a2a44 }));
    geoRing.rotation.x = Math.PI / 2; this.earth.add(geoRing);
    const dots = new THREE.BufferGeometry(); const dp = [];
    for (let i = 0; i < 1440; i++) { const t = i / 1440 * Math.PI * 2; dp.push(Math.cos(t) * GEO, 0.006, Math.sin(t) * GEO); }
    dots.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3));
    this.geoDots = new THREE.Points(dots, new THREE.PointsMaterial({ color: new THREE.Color(1.6, 1.3, 0.9), size: 2, sizeAttenuation: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.earth.add(this.geoDots);
    this.geoRing = geoRing;
  }

  _buildFleet() {
    this.fleet = new THREE.Group(); this.scene.add(this.fleet);
    const flag = buildFlagship(this.mats); flag.scale.setScalar(0.85); this.fleet.add(flag); this.flagship = flag;
    this.fleetPlumes = new Plumes(80, { core: 0xe8f4ff, edge: 0x3d7bff, alt: 0x7d6bff, gain: 1.4, grow: 0.5 });
    const add = (obj, pos, s) => {
      obj.position.copy(pos); obj.scale.setScalar(s); this.fleet.add(obj);
      const back = V(-1, 0, 0);
      this.fleetPlumes.add(pos.clone().add(V(-0.6 * s, 0, 0)), back, 1.2 * s, 0.05 * s, -1, 0.3);
    };
    this.fleetPlumes.add(V(-0.52, 0, 0), V(-1, 0, 0), 1.2, 0.07, -1, 0.3);
    let s = 5; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 22; i++) {
      const e = buildEscort(this.mats, i);
      add(e, V(-0.6 - rnd() * 3.5, (rnd() - .5) * 0.9, (rnd() - .5) * 1.8), 0.2 + rnd() * 0.15);
    }
    this.fleetPlumes.commit(); this.fleet.add(this.fleetPlumes.mesh);
    // 舰队编队朝向：沿 +X 局部轴前进
    this.ringShip = buildRingShip(this.mats); this.ringShip.scale.setScalar(0.9); this.ringShip.visible = false; this.scene.add(this.ringShip);
  }

  _buildPlanets(tex) {
    const mk = (map, r, opts) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 160, 80), planetMaterial(map, opts)); m.visible = false; this.scene.add(m); return m; };
    this.jupiter = mk(tex.jupiter, 11.2, { rim: new THREE.Color(0.8, 0.25, 0.12), rimGain: 0.35, grade: 1 });
    this.saturn = mk(tex.saturn, 9.4, { rim: new THREE.Color(0.9, 0.8, 0.6), rimGain: 0.3 });
    this.neptune = mk(tex.neptune, 3.9, { rim: new THREE.Color(0.4, 0.6, 1.2), rimGain: 0.8 });
    this.moon = mk(tex.moon, 0.27, { rimGain: 0.0 });
    // 土星环
    const rg = new THREE.RingGeometry(1.24, 2.27, 256, 1);
    const pos = rg.attributes.position, uv = rg.attributes.uv;
    for (let i = 0; i < pos.count; i++) { const r = Math.hypot(pos.getX(i), pos.getY(i)); uv.setXY(i, (r - 1.24) / (2.27 - 1.24), 0.5); }
    this.ringMat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: tex.saturn_ring }, uSun: { value: V(1, 0, 0) }, uSunInt: { value: 1 }, uC: { value: V() }, uR: { value: 9.4 } },
      transparent: true, side: THREE.DoubleSide, depthWrite: false,
      vertexShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec2 vUv; varying vec3 vW; varying vec3 vN;
        void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * vec3(0.0,0.0,1.0)); gl_Position = projectionMatrix * viewMatrix * w;
        #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_fragment>
        uniform sampler2D uMap; uniform vec3 uSun, uC; uniform float uSunInt, uR; varying vec2 vUv; varying vec3 vW; varying vec3 vN;
        void main(){
          #include <logdepthbuf_fragment>
          vec4 c = texture2D(uMap, vec2(vUv.x, 0.5));
          // 行星阴影
          vec3 toP = vW - uC; float along = dot(toP, -uSun); vec3 perp = toP + uSun * along;
          float sh = (along > 0.0 && length(perp) < uR) ? 0.08 : 1.0;
          float lit = 0.35 + 0.65 * abs(dot(normalize(vN), uSun));
          gl_FragColor = vec4(c.rgb * 1.25 * lit * sh * uSunInt, c.a * 0.95);
        }`,
    });
    this.rings = new THREE.Mesh(rg, this.ringMat); this.rings.scale.setScalar(9.4); this.rings.visible = false; this.scene.add(this.rings);
  }

  _buildInterstellar() {
    // 速度流线
    this.streak = streaks(1600, { span: 26, len: 1.6, color: new THREE.Color(0.55, 0.72, 1.5) }); this.scene.add(this.streak);
    // 冰屑
    this.shard = shards(1500, 14); this.shard.visible = false; this.scene.add(this.shard);
    // 弓形激波
    const bg = new THREE.SphereGeometry(1, 96, 48, 0, Math.PI * 2, 0, Math.PI * 0.62);
    this.bowMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOp: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec3 vN; varying vec3 vW; varying vec3 vL;
        void main(){ vL = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
        #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_fragment>
        uniform float uTime, uOp; varying vec3 vN; varying vec3 vW; varying vec3 vL;
        ${NOISE}
        void main(){
          #include <logdepthbuf_fragment>
          vec3 V = normalize(cameraPosition - vW);
          float f = pow(1.0 - abs(dot(normalize(vN), V)), 2.5);
          float n = fbm(vL * 4.0 + vec3(0.0, -uTime * 0.6, 0.0));
          float edge = smoothstep(0.0, 0.25, vL.y + 0.25);
          vec3 c = mix(vec3(0.35, 0.3, 1.0), vec3(0.8, 0.5, 1.0), n);
          gl_FragColor = vec4(c * f * (0.5 + n) * uOp * edge, 1.0);
        }`,
    });
    this.bow = new THREE.Mesh(bg, this.bowMat); this.bow.scale.set(1.9, 1.3, 1.9); this.bow.visible = false; this.scene.add(this.bow);
    // 极光
    const aur = (y) => {
      const g = new THREE.CylinderGeometry(0.42, 0.36, 0.12, 128, 1, true); g.translate(0, y, 0);
      const m = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uOp: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        vertexShader: `#include <common>
          #include <logdepthbuf_pars_vertex>
          varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
          #include <logdepthbuf_vertex>
          }`,
        fragmentShader: `#include <common>
          #include <logdepthbuf_pars_fragment>
          uniform float uTime, uOp; varying vec2 vUv;
          void main(){
          #include <logdepthbuf_fragment>
          float c = 0.5 + 0.5 * sin(vUv.x * 80.0 + uTime * 1.5) * sin(vUv.x * 23.0 - uTime);
          float v = smoothstep(0.0, 0.3, vUv.y) * (1.0 - vUv.y);
          gl_FragColor = vec4(vec3(0.3, 1.2, 0.7) * c * v * uOp, 1.0); }`,
      });
      const mesh = new THREE.Mesh(g, m); return mesh;
    };
    this.auroraN = aur(0.93); this.auroraS = aur(-0.93); this.auroraS.rotation.x = Math.PI;
    this.earth.add(this.auroraN, this.auroraS);
    // 日球层顶（一张起伏的薄幕）
    const hg = new THREE.PlaneGeometry(60, 60, 1, 1);
    this.helioMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOp: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `#include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <common>
        #include <logdepthbuf_pars_fragment>
        uniform float uTime, uOp; varying vec2 vUv;
        ${NOISE}
        void main(){
          #include <logdepthbuf_fragment>
          vec2 p = (vUv - 0.5) * 6.0;
          float n = fbm(vec3(p * 1.3, uTime * 0.08));
          float m = fbm(vec3(p * 3.1 + 7.0, uTime * 0.12));
          float r = 1.0 - smoothstep(1.5, 3.0, length(p));
          vec3 c = mix(vec3(0.7, 0.25, 0.75), vec3(0.3, 0.35, 1.0), m);
          gl_FragColor = vec4(c * pow(n, 2.2) * 1.8 * r * uOp, 1.0);
        }`,
    });
    this.helio = new THREE.Mesh(hg, this.helioMat); this.helio.visible = false; this.scene.add(this.helio);
    // 新的太阳：比邻星（红矮星）；acenB 是 0.2 光年外的半人马座 α A/B，只是一颗很亮的星
    this.acenA = glowSprite(new THREE.Color(2.6, 1.35, 0.7), 1, { power: 3.2, opacity: 0 }); this.scene.add(this.acenA);
    this.acenB = glowSprite(new THREE.Color(2.2, 2.0, 1.7), 1, { power: 4.0, opacity: 0 }); this.scene.add(this.acenB);
    // 远去的太阳
    this.oldSun = glowSprite(new THREE.Color(2.4, 2.0, 1.5), 1, { power: 3, opacity: 0 }); this.scene.add(this.oldSun);
  }

  // —— 镜头 ——
  // 每个镜头返回 {pos, look, fov, up?}；u 为镜头内 0..1 进度
  shot(t) {
    const E = this.earth;
    const W = (v) => v.clone().applyQuaternion(E.quaternion);
    const hero = W(this.heroV), anchor = W(this.anchorV);
    const side = (n) => V(0, 1, 0).cross(n).normalize();
    // 环绕镜头：沿 dir 方向、距地心 dist 处看向地心（+ 偏移），地球约占画面高度 2/(dist·2·tan(fov/2))
    const orbit = (dir, dist, fov, off = V(0, 0, 0)) => ({ pos: dir.clone().normalize().multiplyScalar(dist), look: off, fov });
    // 新太阳构图：相机在地球背向恒星一侧、略高于地—星连线，恒星在画面中上方，地球边缘在下方
    const acS = V(-0.8, 0.26, 0.5).normalize();
    const acU = V(0, 1, 0).addScaledVector(acS, -acS.y).normalize();
    const acR = acS.clone().cross(acU).normalize();
    const newSun = (back, up, lat, pitch, fov) => {
      const pos = acS.clone().multiplyScalar(-back).addScaledVector(acU, up).addScaledVector(acR, lat);
      const star = acS.clone().multiplyScalar(60);
      const d = star.clone().sub(pos).length();
      return { pos, look: star.addScaledVector(acU, -d * Math.tan(pitch)), fov };
    };
    // 木星飞掠：相机距地球约 9.4（地球占画高约 1/4），木星在地球正后方约 23.4 单位 ≈ 1.5×10⁵ km
    const jupN = V(0.62, 0.14, 0.77).normalize();
    const jupF = jupN.clone().negate(), jupR = jupF.clone().cross(V(0, 1, 0)).normalize(), jupU = jupR.clone().cross(jupF);
    this.jupFrame = { n: jupN, r: jupR, u: jupU };
    const S = [
      // 01 点火全景
      [0, 9.2, (u) => {
        const c = hero.clone().multiplyScalar(lerp(1.2, 1.0, u)).add(side(hero).multiplyScalar(lerp(-2.9, -2.5, u))).add(V(0, lerp(0.9, 0.7, u), 0));
        return { pos: c, look: hero.clone().multiplyScalar(0.55).add(side(hero).multiplyScalar(-0.5)).add(V(0, 0.1, 0)), fov: 40 };
      }],
      // 02 重型阵列近景
      [9.2, 15.2, (u) => {
        const T = side(hero), B = hero.clone().cross(T);
        const c = hero.clone().multiplyScalar(lerp(1.62, 1.5, u)).addScaledVector(T, lerp(-0.62, -0.5, u)).addScaledVector(B, lerp(-0.3, -0.2, u));
        return { pos: c, look: hero.clone().multiplyScalar(1.12).addScaledVector(T, 0.05), fov: 40, up: hero };
      }],
      // 03 太空电梯攀升
      [15.2, 24.0, (u) => {
        const h = 0.02 + Math.pow(u, 1.8) * 5.4;
        const T = side(anchor);
        const c = anchor.clone().multiplyScalar(1 + h + 0.03 + u * 0.4).addScaledVector(T, 0.12 + u * 0.9).add(V(0, 0.05 + u * 0.5, 0));
        const lk = anchor.clone().multiplyScalar(1 + h * 0.8 - 0.06 - u * 0.6);
        return { pos: c, look: lk, fov: lerp(52, 40, u), up: anchor, climb: h };
      }],
      // 04 天枢站
      [24.0, 30.0, (u) => {
        const top = anchor.clone().multiplyScalar(GEO);
        const T = side(anchor);
        const c = top.clone().addScaledVector(anchor, lerp(0.75, 0.55, u)).addScaledVector(T, lerp(0.42, 0.2, u)).add(V(0, lerp(0.18, 0.26, u), 0));
        return { pos: c, look: top.clone().addScaledVector(anchor, -0.55), fov: 46, climb: 5.62 };
      }],
      // 05 领航员舰队
      [30.0, 36.4, (u) => {
        const F = this.fleet.position;
        const c = F.clone().add(V(lerp(1.0, 0.35, u), lerp(0.22, 0.16, u), lerp(0.75, 0.9, u)));
        return { pos: c, look: F.clone().add(V(-0.9 - u * 0.6, -0.08, -0.1)), fov: 44 };
      }],
      // 08 木星引力弹射
      [52.0, 60.0, (u) => {
        const n = jupN.clone().addScaledVector(jupR, lerp(-0.03, 0.03, u)).normalize();
        return { pos: n.multiplyScalar(lerp(9.7, 9.1, u)), look: jupR.clone().multiplyScalar(0.7).addScaledVector(jupU, 1.2), fov: 46 };
      }],
      // 09 土星环面穿越
      [60.0, 66.4, (u) => ({ pos: V(lerp(3.6, 3.0, u), lerp(0.7, 0.25, u), lerp(2.2, 2.8, u)), look: V(-2.0, -0.6, -2.2), fov: 48 })],
      // 10 海王星
      [66.0, 76.4, (u) => orbit(V(lerp(3.0, 3.6, u), lerp(0.5, 0.8, u), lerp(2.6, 2.2, u)), lerp(4.9, 4.6, u), 44, V(-0.35, 0.1, -0.25))],
      // 11 柯伊伯带
      [76.4, 86.0, (u) => orbit(V(lerp(2.5, 2.1, u), lerp(0.35, 0.18, u), lerp(1.9, 1.7, u)), lerp(4.6, 4.3, u), 48)],
      // 12 日球层顶
      [86.0, 96.4, (u) => orbit(V(lerp(3.2, 2.4, u), lerp(0.6, 0.3, u), lerp(-2.0, -1.2, u)), lerp(5.0, 4.6, u), 44)],
      // 13 冰封地球与舰队
      [96.0, 106.6, (u) => orbit(V(lerp(4.4, 3.8, u), lerp(1.5, 1.1, u), lerp(2.4, 2.9, u)), lerp(5.4, 5.0, u), 40, V(0.1, 0.05, 0.05))],
      // 14 赤道发动机项链 + 弓形激波
      [106.6, 116.0, (u) => orbit(V(lerp(2.9, 2.5, u), lerp(0.5, 0.25, u), lerp(2.2, 2.0, u)), lerp(4.7, 4.4, u), 46)],
      // 15 环形舰掠过
      [116.0, 126.4, (u) => orbit(V(lerp(4.2, 3.6, u), lerp(0.4, 0.7, u), lerp(3.0, 3.4, u)), lerp(4.9, 4.6, u), 44)],
      // 17 新太阳：掉头减速
      [152.0, 164.0, (u) => newSun(lerp(2.6, 2.25, u), lerp(1.85, 1.6, u), lerp(0.35, 0.1, u), 0.13, 44)],
      // 18 抵达
      [164.0, 174.5, (u) => newSun(lerp(2.25, 2.7, u), lerp(1.6, 2.0, u), lerp(0.1, -0.15, u), 0.13, 44)],
    ];
    for (const [a, b, f] of S) if (t >= a && t < b) return f((t - a) / (b - a));
    return null;
  }

  // 每帧：根据影片时间 t 设置场景参数
  update(t, dt, clock) {
    const E = this.earth;
    const ch = t < 36 ? 1 : t < 66 ? 2 : t < 96 ? 3 : t < 126 ? 4 : t < 152 ? 5 : 6;
    // 地球自转：第一章角速度从 W0 线性降到 0（对时间积分，seek 到任意时刻结果一致）；
    // 第二到第五章停转，只有云层飘动；第六章 158 秒掉头后重新开始转
    const W0 = 0.008, STOP = 36, SPIN_FIXED = 3.70;   // 停转后东亚朝向镜头
    const tc = Math.min(t, STOP);
    let spin = SPIN_FIXED - W0 * STOP / 2 + W0 * (tc - tc * tc / (2 * STOP));
    if (t >= 158) spin = SPIN_FIXED + 0.5 * 0.00025 * (t - 158) * (t - 158);
    E.rotation.set(0.18, spin, 0);
    // 太阳方向与强度
    const heroW0 = this.heroV.clone().applyQuaternion(E.quaternion);
    const sideW = V(0, 1, 0).cross(heroW0).normalize();
    let sun = heroW0.clone().multiplyScalar(0.45).addScaledVector(sideW, 0.85).add(V(0, 0.25, 0)).normalize(), sunInt = 1.0, sunCol = new THREE.Color(1, 0.96, 0.9);
    if (ch >= 2) { sun = V(0.55, 0.22, 0.8).normalize(); sunInt = keyed([[36, 1], [60, 0.75], [66, 0.5], [76, 0.28], [96, 0.16], [126, 0.08]], t); }
    if (ch === 6) {
      const k = sstep(152, 170, t);
      sun = V(-0.8, 0.26, 0.5).normalize();
      sunInt = lerp(0.1, 0.8, k);
      sunCol = new THREE.Color(lerp(0.8, 1.0, k), lerp(0.85, 0.66, k), lerp(1.0, 0.46, k));   // 比邻星偏红
    }
    const freeze = keyed([[0, 0], [60, 0.15], [86, 0.55], [100, 1.0], [160, 1.0], [174, 0.86]], t);
    const mu = this.earthMat.uniforms;
    mu.uSun.value.copy(sun); mu.uSunInt.value = sunInt; mu.uSunCol.value.copy(sunCol);
    mu.uFreeze.value = freeze; mu.uTime.value = clock; mu.uCloudRot.value = clock * 0.0015;
    mu.uCity.value = 0.65 + freeze * 1.6;
    const heroW = this.heroV.clone().applyQuaternion(E.quaternion);
    mu.uGlowCenter.value.copy(heroW);
    const engOn = 1 - sstep(51.4, 52.4, t) + sstep(59.6, 61.6, t);
    mu.uEngineGlow.value = (ch === 1 ? sstep(1, 12, t) * 1.1 : ch === 6 && t > 157 ? 0.9 : 0.5) * engOn;
    const cu = this.cloudMat.uniforms; cu.uSun.value.copy(sun); cu.uSunInt.value = sunInt; cu.uRot.value = clock * 0.0015; cu.uFreeze.value = freeze; cu.uSunCol.value.copy(sunCol);
    this.atmoMat.uniforms.uSun.value.copy(sun); this.atmoMat.uniforms.uSunInt.value = Math.max(sunInt, 0.25);
    this.atmoMat.uniforms.uCol.value.setRGB(lerp(0.28, 0.55, freeze), lerp(0.55, 0.7, freeze), 1.0);
    this.sunLight.position.copy(sun).multiplyScalar(50); this.sunLight.intensity = 2.6 * sunInt; this.sunLight.color.copy(sunCol);

    // 发动机
    const P = this.plumes;
    P.uniforms.uTime.value = clock;
    P.uniforms.uIgnite.value = ch === 1 ? t - 1.2 : 1e5;
    let gain = 0.42;
    if (ch === 6) gain = t < 156.5 ? 0.25 : 0.25 + sstep(156.5, 160, t) * 0.3;
    if (ch >= 4 && ch < 6) gain = 0.38;
    // 飞掠木星：发动机全部关闭（52 秒熄火，60 秒飞离后重新点火）
    const on = 1 - sstep(51.4, 52.4, t) + sstep(59.6, 61.6, t);
    this.engineOn = on;
    P.uniforms.uGain.value = gain * on;
    P.uniforms.uLen.value = ch === 1 ? 1.0 : ch >= 4 ? 0.85 : 0.92;
    this.heroGlow.material.uniforms.uOp.value = (ch === 1 ? sstep(1, 4, t) * 0.35 : 0.15) * on;
    this.heroRing.material.opacity = (ch === 1 ? 0.9 : 0.4) * (0.25 + 0.75 * on);
    this.plumeLight.position.copy(heroW.clone().multiplyScalar(1.2));
    this.plumeLight.intensity = (ch === 1 ? 2.5 * sstep(1, 6, t) : 0.6) * on;

    // 电梯：攀爬舱
    const sh = this.shot(t);
    const climb = sh && sh.climb !== undefined ? sh.climb : 2.2 + Math.sin(clock * 0.05) * 1.5;
    this.climber.position.y = climb; this.climberLight.position.y = climb + 0.02;
    this.station.userData.rings[0].rotation.y = clock * 0.25; this.station.userData.rings[1].rotation.y = -clock * 0.25;
    const showElev = ch <= 2 || ch === 6;
    this.elev.visible = showElev; this.geoRing.visible = showElev; this.geoDots.visible = showElev;

    // 舰队：位于前进方向（世界 -X 偏前）
    const fleetOn = (t >= 28 && t < 37) || (t >= 96 && t < 126);
    this.fleet.visible = fleetOn;
    this.fleet.position.set(-2.8 + (t % 40) * 0.01, 0.35, -0.6);
    if (t >= 96) this.fleet.position.set(1.3, 1.05, 1.0);
    this.fleetPlumes.uniforms.uTime.value = clock; this.fleetPlumes.uniforms.uIgnite.value = 1e5;
    this.fleet.children.forEach((c, i) => { if (c !== this.flagship && c !== this.fleetPlumes.mesh) c.position.y += Math.sin(clock * 0.3 + i) * 0.0002; });
    // 环形舰
    this.ringShip.visible = t >= 114 && t < 126.5;
    if (this.ringShip.visible) { const u = (t - 114) / 12.5; this.ringShip.position.set(lerp(0.4, -1.8, u), 0.15, lerp(1.6, 1.0, u)); this.ringShip.rotation.set(0.25, 0.9 + u * 0.3, clock * 0.05); }

    // 行星背景
    this.jupiter.visible = t >= 50 && t < 60.2;
    if (this.jupiter.visible) {
      // 地球后方约 1.5×10⁵ km（23.4 地球半径，洛希极限约 1.1×10⁵ km），木星半径 11.2 ≈ 7.1×10⁴ km
      const u = (t - 52) / 8, J = this.jupFrame || (this.shot(55), this.jupFrame);
      this.jupiter.position.copy(J.n).multiplyScalar(-22.3).addScaledVector(J.r, lerp(6.0, 5.0, u)).addScaledVector(J.u, lerp(4.8, 4.2, u));
      this.jupiter.rotation.y = clock * 0.03;
    }
    this.saturn.visible = this.rings.visible = t >= 60 && t < 66.6;
    if (this.saturn.visible) {
      const u = (t - 60) / 6.4;
      this.saturn.position.set(lerp(-30, -24, u), lerp(-5, -3, u), lerp(-36, -32, u));
      this.saturn.rotation.set(0.42, 0, 0.12);
      this.rings.position.copy(this.saturn.position); this.rings.rotation.set(-Math.PI / 2 + 0.42 + lerp(0.02, -0.03, u), 0, 0.12);
      this.ringMat.uniforms.uC.value.copy(this.saturn.position); this.ringMat.uniforms.uSun.value.copy(sun); this.ringMat.uniforms.uSunInt.value = sunInt * 1.6;
    }
    this.neptune.visible = t >= 66 && t < 76.6;
    if (this.neptune.visible) { const u = (t - 66) / 10.4; this.neptune.position.set(lerp(-15, -11, u), lerp(3.2, 2.4, u), lerp(-12, -11, u)); }
    for (const p of [this.jupiter, this.saturn, this.neptune]) { p.material.uniforms.uSun.value.copy(sun); p.material.uniforms.uSunInt.value = Math.max(sunInt, 0.35) * 1.25; }
    this.moon.visible = ch === 1 && t > 28;
    this.moon.position.set(-6, 1.2, -9); this.moon.material.uniforms.uSun.value.copy(sun);

    // 星际效果
    const flow = ch >= 3 && ch !== 5;
    this.streak.visible = flow || (ch === 2 && t > 40);
    const su = this.streak.material.uniforms;
    su.uTime.value = clock; su.uDir.value.set(1, 0, 0.35).normalize();
    su.uSpeed.value = ch >= 4 ? 14 : 7; su.uOp.value = ch === 2 ? 0.25 : ch === 3 ? 0.45 : ch === 4 ? 0.9 : 0.35 * (1 - sstep(156, 170, t));
    su.uCenter.value.copy(this.camera.position);
    this.shard.visible = t >= 76 && t < 87;
    if (this.shard.visible) updateShards(this.shard, clock, V(2.4, 0, 0.8));
    this.bow.visible = ch === 4 || (ch === 3 && t > 90);
    this.bowMat.uniforms.uTime.value = clock; this.bowMat.uniforms.uOp.value = ch === 4 ? 0.13 : sstep(90, 96, t) * 0.1;
    this.bow.position.set(-0.9, 0, -0.3); this.bow.lookAt(V(-3, 0, -1)); this.bow.rotateX(-Math.PI / 2);
    for (const a of [this.auroraN, this.auroraS]) { a.material.uniforms.uTime.value = clock; a.material.uniforms.uOp.value = ch === 4 ? 0.35 : ch === 3 ? 0.15 : 0; }
    this.helio.visible = t >= 86 && t < 97;
    if (this.helio.visible) { const u = (t - 86) / 10.4; this.helio.position.set(lerp(-6, 4, u), 0, lerp(-2, 1.4, u)); this.helio.lookAt(V(-20, 0, -7)); this.helioMat.uniforms.uTime.value = clock; this.helioMat.uniforms.uOp.value = Math.sin(Math.min(1, u * 1.1) * Math.PI) * 0.9; }
    // 天空
    const neb = ch === 3 ? sstep(84, 92, t) * 0.7 : ch === 4 ? 0.35 : 0;
    this.sky.material.uniforms.uNeb.value = neb;
    this.sky.material.uniforms.uExp.value = ch === 1 ? 0.55 : ch === 2 ? 0.7 : 1.0;
    this.stars.material.uniforms.uTime.value = clock;
    // 比邻星
    const ac = ch === 6 ? sstep(152, 168, t) : ch === 4 ? 0.08 + sstep(116, 126, t) * 0.12 : 0;
    const acDir = V(-0.8, 0.26, 0.5).normalize();
    this.acenA.position.copy(acDir.clone().multiplyScalar(60)); this.acenA.scale.setScalar(lerp(5, 34, ac)); this.acenA.material.uniforms.uOp.value = ac > 0 ? 0.25 + ac : 0;
    this.acenB.position.copy(V(-0.55, 0.62, 0.56).normalize().multiplyScalar(60)); this.acenB.scale.setScalar(lerp(1.2, 2.6, ac)); this.acenB.material.uniforms.uOp.value = ac > 0 ? 0.2 + ac * 0.5 : 0;
    const os = ch === 2 ? 1 : ch === 3 ? 0.5 : 0;
    this.oldSun.position.copy(sun.clone().multiplyScalar(80)); this.oldSun.scale.setScalar(ch === 2 ? 16 : 7); this.oldSun.material.uniforms.uOp.value = os * sunInt;
    this.oldSun.visible = os > 0;
    this.state = { ch, freeze, sunInt };
  }

  // 探索模式的目的地
  destinations() {
    const E = this.earth;
    const W = (v) => v.clone().applyQuaternion(E.quaternion);
    return [
      { name: '地球', en: 'EARTH', get: () => ({ target: V(0, 0, 0), dist: 3.0 }) },
      { name: '重型发动机阵列', en: 'HEAVY ARRAY', get: () => ({ target: W(this.heroV).multiplyScalar(1.05), dist: 0.35 }) },
      { name: '赤道转向阵列', en: 'STEERING ARRAY', get: () => ({ target: W(lonlat(60, 0)).multiplyScalar(1.05), dist: 0.5 }) },
      { name: '太空电梯锚点', en: 'ANCHOR', get: () => ({ target: W(this.anchorV).multiplyScalar(1.03), dist: 0.22 }) },
      { name: '天枢站', en: 'TIANSHU', get: () => ({ target: W(this.anchorV).multiplyScalar(GEO), dist: 0.7 }) },
      { name: '领航员号舰队', en: 'NAVIGATOR', get: () => ({ target: this.fleet.position.clone(), dist: 1.2 }) },
      { name: '月球', en: 'LUNA', get: () => ({ target: this.moon.position.clone(), dist: 1.0 }) },
    ];
  }
}
