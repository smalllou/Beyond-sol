// 贴图加载（带进度）
// 8K 贴图（地球昼/夜/云、木星）优先加载 KTX2（UASTC + Zstd，GPU 直接用压缩格式，显存约省 4–8 倍）；
// 浏览器不支持任何压缩纹理格式、或 KTX2 加载失败时，逐张回退到同名 JPG。?ktx2=0 可强制用 JPG。
import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

const BASE = (import.meta.env && import.meta.env.BASE_URL) || './';
const KTX2 = { earth_day: 'earth_day.ktx2', earth_night: 'earth_night.ktx2', earth_clouds: 'earth_clouds.ktx2', jupiter: 'jupiter.ktx2' };
const LIST = {
  earth_day: ['earth_day.jpg', true], earth_night: ['earth_night.jpg', true], earth_clouds: ['earth_clouds.jpg', false],
  earth_spec: ['earth_spec.jpg', false], earth_normal: ['earth_normal.jpg', false],
  jupiter: ['jupiter.jpg', true], saturn: ['saturn.jpg', true], saturn_ring: ['saturn_ring.png', true],
  sun: ['sun.jpg', true], mars: ['mars.jpg', true], mercury: ['mercury.jpg', true],
  venus: ['venus.jpg', true], uranus: ['uranus.jpg', true], neptune: ['neptune.jpg', true],
  milkyway: ['milkyway_eso.jpg', true],
  // 方舟号站体 PBR（Poly Haven CC0）
  pbr_plate_diff: ['pbr/metal_plate_02_diff_1k.jpg', true], pbr_plate_nor: ['pbr/metal_plate_02_nor_gl_1k.jpg', false], pbr_plate_arm: ['pbr/metal_plate_02_arm_1k.jpg', false],
  pbr_shutter_diff: ['pbr/painted_metal_shutter_diff_1k.jpg', true], pbr_shutter_nor: ['pbr/painted_metal_shutter_nor_gl_1k.jpg', false], pbr_shutter_arm: ['pbr/painted_metal_shutter_arm_1k.jpg', false],
  pbr_blue_diff: ['pbr/blue_metal_plate_diff_1k.jpg', true], pbr_blue_nor: ['pbr/blue_metal_plate_nor_gl_1k.jpg', false], pbr_blue_arm: ['pbr/blue_metal_plate_arm_1k.jpg', false],
};

export function loadTextures(renderer, onProgress) {
  const mgr = new THREE.LoadingManager();
  const loader = new THREE.TextureLoader(mgr);
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const ktx2 = makeKTX2Loader(renderer);
  const out = {};
  const keys = Object.keys(LIST);
  let done = 0;
  return new Promise((resolve) => {
    const finish = (k, t) => {
      out[k] = t;
      done++; onProgress(done / keys.length);
      if (done === keys.length) { if (ktx2) ktx2.dispose(); resolve(out); }
    };
    const loadJPG = (k) => {
      const [file, srgb] = LIST[k];
      loader.load(`${BASE}assets/tex/${file}`, (t) => {
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.anisotropy = Math.min(8, aniso);
        finish(k, t);
      }, undefined, () => { console.warn('贴图加载失败', file); finish(k, new THREE.Texture()); });
    };
    keys.forEach((k) => {
      if (!ktx2 || !KTX2[k]) return loadJPG(k);
      ktx2.load(`${BASE}assets/tex/${KTX2[k]}`, (t) => {
        // 与 JPG 一致：颜色贴图 sRGB、数据贴图线性；编码时已做 -y_flip，与 TextureLoader 的 flipY 方向相同
        t.colorSpace = LIST[k][1] ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.anisotropy = Math.min(8, aniso);
        t.needsUpdate = true;
        finish(k, t);
      }, undefined, (e) => { console.warn('KTX2 加载失败，回退 JPG', KTX2[k], e && e.message); loadJPG(k); });
    });
  });
}

// 只在浏览器真正支持某种 GPU 压缩格式时启用 KTX2；否则会解码成未压缩 RGBA，反而比 JPG 更占显存
function makeKTX2Loader(renderer) {
  if (new URLSearchParams(location.search).get('ktx2') === '0') return null;
  try {
    const l = new KTX2Loader().setTranscoderPath(`${BASE}assets/basis/`).detectSupport(renderer);
    const c = l.workerConfig || {};
    const ok = c.astcSupported || c.bptcSupported || c.etc2Supported || c.dxtSupported || c.etc1Supported || c.pvrtcSupported;
    if (!ok) { l.dispose(); console.info('KTX2：浏览器不支持压缩纹理，使用 JPG'); return null; }
    return l;
  } catch (e) { console.warn('KTX2 初始化失败，使用 JPG', e); return null; }
}
