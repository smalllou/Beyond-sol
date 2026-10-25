// 入口：渲染器、后期、导演（镜头与世界切换）、模式切换、交互
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadTextures } from './assets.js';
import { EarthWorld } from './worlds/earth.js';
import { SolarWorld } from './worlds/solar.js';
import { GalaxyWorld } from './worlds/galaxy.js';
import { HUD } from './hud.js';
import { Score } from './audio.js';
import { DURATION, TELE, keyed } from './story.js';

const params = new URLSearchParams(location.search);
const STILL = params.has('t');            // 调试：?t=秒 定格到影片某一时刻
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
const dpr = Math.min(window.devicePixelRatio, params.has('dpr') ? +params.get('dpr') : 1.5);
renderer.setPixelRatio(dpr);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const FinalShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uFade: { value: 0 }, uVig: { value: 0.9 }, uGrain: { value: 0.035 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uFade, uVig, uGrain; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5;
      float ca = dot(d, d) * 0.004;
      vec3 c = vec3(texture2D(tDiffuse, vUv + d * ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - d * ca).b);
      float v = 1.0 - dot(d * vec2(1.0, 0.8), d * vec2(1.0, 0.8)) * uVig;
      c *= clamp(v, 0.0, 1.0);
      c += (h(vUv * uRes + fract(uTime) * 100.0) - 0.5) * uGrain;
      c *= 1.0 - uFade;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

const hud = new HUD({ onSeek: (t) => seek(t), onPlay: () => togglePlay() });
const score = new Score();
let worlds = null, composer, renderPass, bloom, finalPass, controls;
let filmT = STILL ? +params.get('t') : 0, playing = !STILL, mode = 'film', clock = STILL ? +params.get('t') : 0;
let activeWorld = null, explore = null;

function setupComposer() {
  composer = new EffectComposer(renderer);
  renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
  composer.addPass(renderPass);
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.85, 0.55, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  finalPass = new ShaderPass(FinalShader);
  composer.addPass(finalPass);
  composer.setPixelRatio(dpr);
  composer.setSize(innerWidth, innerHeight);
}

function worldFor(t) {
  if (t >= 36 && t < 52) return worlds.solar;
  if (t >= 126 && t < 152) return worlds.galaxy;
  return worlds.earth;
}
// 世界切换：完整溶黑；行星镜头之间：约 0.8 秒的短暂溶暗，避免上一颗消失、下一颗立刻出现的硬切
const CUTS = [[36, 0.45, 1], [52, 0.45, 1], [126, 0.45, 1], [152, 0.45, 1], [60, 0.4, 0.9], [66.4, 0.4, 0.9], [76.4, 0.4, 0.85], [86, 0.4, 0.8]];
function fadeFor(t) {
  let f = 0;
  if (t < 1.2) f = 1 - t / 1.2;
  for (const [c, w, k] of CUTS) { const d = Math.abs(t - c); if (d < w) f = Math.max(f, (1 - d / w) * k); }
  if (t > DURATION - 1.5) f = Math.max(f, (t - (DURATION - 1.5)) / 1.5);
  return Math.min(1, f);
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h); composer.setSize(w, h);
  finalPass.uniforms.uRes.value.set(w, h);
  if (worlds) for (const W of Object.values(worlds)) { W.camera.aspect = w / h; W.camera.updateProjectionMatrix(); }
}

function applyShot(W, t) {
  const s = W.shot(t);
  if (!s) return;
  const cam = W.camera;
  cam.position.copy(s.pos);
  cam.up.copy(s.up ? s.up.clone().normalize() : new THREE.Vector3(0, 1, 0));
  cam.lookAt(s.look);
  if (s.roll) cam.rotateZ(s.roll);
  if (cam.fov !== s.fov) { cam.fov = s.fov; cam.updateProjectionMatrix(); }
  if (s.near && cam.near !== s.near) { cam.near = s.near; cam.far = s.far || cam.far; cam.updateProjectionMatrix(); }
}

function seek(t) {
  filmT = Math.max(0, Math.min(DURATION - 0.01, Number.isFinite(t) ? t : 0));
  if (mode !== 'film') setMode('film');
}
function togglePlay() {
  if (mode !== 'film') { setMode('film'); return; }
  playing = !playing; hud.setPlaying(playing);
  if (playing) score.start();
}

function setMode(m) {
  mode = m;
  document.getElementById('btn-film').classList.toggle('on', m === 'film');
  document.getElementById('btn-explore').classList.toggle('on', m === 'explore');
  document.getElementById('hud').classList.toggle('explore', m === 'explore');
  if (m === 'explore') {
    playing = false; hud.setPlaying(false);
    const W = activeWorld;
    controls = new OrbitControls(W.camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.06;
    controls.zoomSpeed = 0.8; controls.rotateSpeed = 0.5;
    const dst = W.destinations();
    explore = { W, dst, fly: null };
    const d0 = dst[0].get();
    controls.target.copy(d0.target);
    controls.minDistance = W.minDist || 0.02; controls.maxDistance = W.maxDist || 400;
    const ul = document.getElementById('dest-list');
    ul.innerHTML = '';
    dst.forEach((d, i) => {
      const li = document.createElement('li');
      li.innerHTML = `${d.name}<small>${d.en}</small>`;
      li.onclick = () => flyTo(i);
      ul.appendChild(li);
    });
  } else {
    if (controls) { controls.dispose(); controls = null; }
    explore = null;
  }
}
function flyTo(i) {
  if (!explore) return;
  const { W, dst } = explore;
  const d = dst[i].get();
  const cam = W.camera;
  const dir = cam.position.clone().sub(controls.target).normalize();
  explore.fly = { t: 0, fromT: controls.target.clone(), toT: d.target, fromP: cam.position.clone(), toP: d.target.clone().addScaledVector(dir, d.dist) };
  [...document.getElementById('dest-list').children].forEach((li, k) => li.classList.toggle('on', k === i));
}

// 键盘
addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  if (e.key === 'm' || e.key === 'M') document.getElementById('btn-audio').click();
  if (e.key === 'h' || e.key === 'H') document.getElementById('btn-hud').click();
  if (e.key === 'f' || e.key === 'F') setMode(mode === 'film' ? 'explore' : 'film');
  if (e.key === 'ArrowRight') seek(filmT + 5);
  if (e.key === 'ArrowLeft') seek(filmT - 5);
});
// 影片中滚轮：穿越时间
canvas.addEventListener('wheel', (e) => { if (mode === 'film') { filmT = Math.max(0, Math.min(DURATION - 0.01, filmT + e.deltaY * 0.01)); } }, { passive: true });
document.getElementById('btn-film').onclick = () => { if (mode !== 'film') setMode('film'); playing = true; hud.setPlaying(true); score.start(); };
document.getElementById('btn-explore').onclick = () => setMode('explore');
document.getElementById('btn-audio').onclick = (e) => { score.start(); const on = score.toggle(); e.currentTarget.classList.toggle('off', !on); };
document.getElementById('btn-hud').onclick = () => document.getElementById('hud').classList.toggle('hidden');
document.getElementById('btn-full').onclick = () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); };

let last = performance.now();
function frame(now) {
  // rAF 的时间戳可能早于点击处理里记录的 performance.now()，dt 必须夹在 [0, 0.1]
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = Math.max(last, now);
  if (playing && mode === 'film') { filmT += dt; if (filmT >= DURATION) { filmT = DURATION - 0.01; playing = false; hud.setPlaying(false); } }
  if (!STILL) clock += dt;
  filmT = Math.max(0, Math.min(DURATION - 0.01, Number.isFinite(filmT) ? filmT : 0));
  const t = filmT;
  const W = mode === 'explore' && explore ? explore.W : worldFor(t);
  if (W !== activeWorld) { activeWorld = W; }
  W.update(t, dt, clock);
  if (mode === 'film') applyShot(W, t);
  else if (controls) {
    if (explore.fly) {
      const f = explore.fly; f.t = Math.min(1, f.t + dt / 2.2);
      const u = f.t * f.t * (3 - 2 * f.t);
      controls.target.lerpVectors(f.fromT, f.toT, u);
      W.camera.position.lerpVectors(f.fromP, f.toP, u);
      if (f.t >= 1) explore.fly = null;
    }
    controls.update();
  }
  renderPass.scene = W.scene; renderPass.camera = W.camera;
  if (W.bloom) { bloom.strength = W.bloom.strength; bloom.threshold = W.bloom.threshold; bloom.radius = W.bloom.radius; }
  finalPass.uniforms.uTime.value = clock;
  finalPass.uniforms.uFade.value = mode === 'film' ? fadeFor(t) : 0;
  composer.render();
  const thrust = keyed(TELE.thrust, t);
  hud.update(t, clock, { range: W.range ? W.range(t) : 8000 });
  score.update(t, thrust, playing && mode === 'film');
  if (!STILL) requestAnimationFrame(frame);
  else window.__frameDone = (window.__frameDone || 0) + 1;
}

async function boot() {
  const bar = document.getElementById('l-bar'), pct = document.getElementById('l-p');
  const tex = await loadTextures(renderer, (p) => { bar.style.width = `${p * 100}%`; pct.textContent = `${Math.round(p * 100)}%`; });
  worlds = { earth: new EarthWorld(tex), solar: new SolarWorld(tex), galaxy: new GalaxyWorld(tex) };
  setupComposer();
  resize();
  addEventListener('resize', resize);
  // 预编译着色器
  for (const W of Object.values(worlds)) { W.update(W === worlds.solar ? 40 : W === worlds.galaxy ? 130 : 1, 0, 0); renderer.compile(W.scene, W.camera); }
  const loader = document.getElementById('loader');
  if (STILL || params.has('autoplay')) {
    loader.classList.add('out');
    if (STILL) { playing = false; hud.setPlaying(false); }
    for (let i = 0; i < (STILL ? 2 : 0); i++) frame(performance.now());
    if (!STILL) requestAnimationFrame(frame);
    window.__ready = true;
    return;
  }
  const go = document.getElementById('l-go');
  go.hidden = false; pct.textContent = 'MOSS 已就绪';
  playing = false;
  frame(performance.now());
  go.onclick = () => { loader.classList.add('out'); filmT = 0; playing = true; hud.setPlaying(true); score.start(); last = performance.now(); };
  window.__ready = true;
}
boot();
window.__seek = (t) => { filmT = t; clock = t; frame(performance.now()); };
window.__state = () => ({ t: filmT, playing, mode });
