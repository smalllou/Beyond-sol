// 等离子光柱：沿轴向朝向相机的实例化条带（axial billboard），单次 draw call 渲染上万条。
import * as THREE from 'three';

const VERT = /* glsl */`
#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec3 aPos;
attribute vec3 aDir;
attribute vec4 aShape;   // x 长度, y 宽度, z 点火时刻, w 随机种子
attribute float aHue;
uniform float uIgnite;
uniform float uTime;
uniform float uLen;
uniform float uWid;
uniform float uGrow;
varying vec2 vUv;
varying float vSeed;
varying float vHue;
varying float vAlive;
varying float vFacing;
varying float vNear;
void main(){
  float grow = smoothstep(aShape.z, aShape.z + uGrow, uIgnite);
  vAlive = grow;
  vSeed = aShape.w;
  vHue = aHue;
  float y = position.y;
  float flick = 1.0 + 0.05 * sin(uTime * (9.0 + aShape.w * 7.0) + aShape.w * 40.0);
  float L = aShape.x * uLen * grow * flick;
  vec3 axis = normalize(aDir);
  vec3 wp = (modelMatrix * vec4(aPos + axis * y * L, 1.0)).xyz;
  vec3 wAxis = normalize(mat3(modelMatrix) * axis);
  vec3 toCam = normalize(cameraPosition - wp);
  vec3 side = cross(wAxis, toCam);
  float sl = length(side);
  side = sl > 1e-4 ? side / sl : vec3(1.0, 0.0, 0.0);
  vFacing = sl;
  float w = aShape.y * uWid * (0.55 + 0.9 * y) * (0.25 + 0.75 * grow);
  wp += side * position.x * w;
  vUv = vec2(position.x, y);
  vNear = smoothstep(0.015, 0.12, distance(cameraPosition, wp));
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  #include <logdepthbuf_vertex>
}`;

const FRAG = /* glsl */`
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uTime;
uniform float uGain;
uniform vec3 uCore;
uniform vec3 uEdge;
uniform vec3 uAlt;
varying vec2 vUv;
varying float vSeed;
varying float vHue;
varying float vAlive;
varying float vFacing;
varying float vNear;
float h1(float n){ return fract(sin(n) * 43758.5453); }
float n1(float x){ float i = floor(x); float f = fract(x); f = f*f*(3.0-2.0*f); return mix(h1(i), h1(i+1.0), f); }
void main(){
  #include <logdepthbuf_fragment>
  if (vAlive < 0.002) discard;
  float x = vUv.x, y = vUv.y;
  float core = exp(-x * x * 26.0);
  float halo = exp(-x * x * 3.2);
  // 沿轴衰减：根部最亮，尾部消散
  float along = pow(1.0 - y, 1.6) * smoothstep(0.0, 0.02, y);
  float tail = pow(1.0 - y, 0.6);
  // 激波钻石与流动湍流
  float diamonds = 0.75 + 0.25 * sin(y * 70.0 - uTime * 26.0 + vSeed * 30.0);
  float turb = 0.7 + 0.6 * n1(y * 18.0 - uTime * 6.0 + vSeed * 91.0);
  float root = exp(-y * 60.0) * 0.5;
  float I = (core * (along * diamonds + root) * 2.0 + halo * tail * 0.035 * turb) * vAlive * vNear;
  vec3 edge = mix(uEdge, uAlt, vHue);
  vec3 col = mix(edge, uCore, clamp(core * (1.2 - y) + root * 0.3, 0.0, 1.0));
  float face = mix(0.12, 1.0, smoothstep(0.15, 0.8, vFacing));
  gl_FragColor = vec4(col * I * uGain * face, 1.0);
}`;

export class Plumes {
  constructor(count, { core = 0xf4f0ff, edge = 0x6f58ff, alt = 0x4f9dff, gain = 1.0, grow = 2.0 } = {}) {
    const base = new THREE.PlaneGeometry(2, 1, 1, 14);
    base.translate(0, 0.5, 0);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute('position', base.attributes.position);
    this.count = count;
    this.aPos = new Float32Array(count * 3);
    this.aDir = new Float32Array(count * 3);
    this.aShape = new Float32Array(count * 4);
    this.aHue = new Float32Array(count);
    g.setAttribute('aPos', new THREE.InstancedBufferAttribute(this.aPos, 3));
    g.setAttribute('aDir', new THREE.InstancedBufferAttribute(this.aDir, 3));
    g.setAttribute('aShape', new THREE.InstancedBufferAttribute(this.aShape, 4));
    g.setAttribute('aHue', new THREE.InstancedBufferAttribute(this.aHue, 1));
    g.instanceCount = 0;
    this.geometry = g;
    this.uniforms = {
      uIgnite: { value: 1e6 }, uTime: { value: 0 }, uLen: { value: 1 }, uWid: { value: 1 }, uGain: { value: gain }, uGrow: { value: grow },
      uCore: { value: new THREE.Color(core) }, uEdge: { value: new THREE.Color(edge) }, uAlt: { value: new THREE.Color(alt) },
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.n = 0;
  }
  add(pos, dir, len, wid, ignite = 0, hue = Math.random()) {
    const i = this.n++;
    this.aPos.set([pos.x, pos.y, pos.z], i * 3);
    this.aDir.set([dir.x, dir.y, dir.z], i * 3);
    this.aShape.set([len, wid, ignite, Math.random()], i * 4);
    this.aHue[i] = hue;
    this.geometry.instanceCount = this.n;
    return i;
  }
  commit() { for (const k of ['aPos', 'aDir', 'aShape', 'aHue']) this.geometry.attributes[k].needsUpdate = true; }
}
