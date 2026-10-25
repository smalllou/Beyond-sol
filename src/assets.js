// 贴图加载（带进度）
import * as THREE from 'three';

const BASE = (import.meta.env && import.meta.env.BASE_URL) || './';
const LIST = {
  earth_day: ['earth_day.jpg', true], earth_night: ['earth_night.jpg', true], earth_clouds: ['earth_clouds.jpg', false],
  earth_spec: ['earth_spec.jpg', false], earth_normal: ['earth_normal.jpg', false],
  jupiter: ['jupiter.jpg', true], saturn: ['saturn.jpg', true], saturn_ring: ['saturn_ring.png', true],
  sun: ['sun.jpg', true], moon: ['moon.jpg', true], mars: ['mars.jpg', true], mercury: ['mercury.jpg', true],
  venus: ['venus.jpg', true], uranus: ['uranus.jpg', true], neptune: ['neptune.jpg', true],
  milkyway: ['milkyway_eso.jpg', true],
};

export function loadTextures(renderer, onProgress) {
  const mgr = new THREE.LoadingManager();
  const loader = new THREE.TextureLoader(mgr);
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const out = {};
  const keys = Object.keys(LIST);
  let done = 0;
  return new Promise((resolve) => {
    keys.forEach((k) => {
      const [file, srgb] = LIST[k];
      loader.load(`${BASE}assets/tex/${file}`, (t) => {
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.anisotropy = Math.min(8, aniso);
        out[k] = t;
        done++; onProgress(done / keys.length);
        if (done === keys.length) resolve(out);
      }, undefined, () => { console.warn('贴图加载失败', file); out[k] = new THREE.Texture(); done++; if (done === keys.length) resolve(out); });
    });
  });
}
