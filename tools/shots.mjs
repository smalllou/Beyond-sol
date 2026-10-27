// 调试截图：node tools/shots.mjs 0,10,20 [宽 高] —— 用 Vite 启动临时服务器，定格到指定影片时刻截图
import { chromium } from 'playwright';
import { createServer } from 'vite';
const times = (process.argv[2] || '5').split(',').map(Number);
const W = +(process.argv[3] || 1280), H = +(process.argv[4] || 720);
const tag = process.argv[5] || '';
const server = await createServer({ server: { port: 5199 }, logLevel: 'error' });
await server.listen();
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: W, height: H } });
p.on('console', m => { const s = m.text(); if (!/GPU stall|swiftshader|WebGL-/.test(s)) console.log('[console]', s.slice(0, 400)); });
p.on('pageerror', e => console.log('[pageerror]', e.message));
const t0 = Date.now();
await p.goto(`http://localhost:5199/?t=${times[0]}&dpr=1`);
await p.waitForFunction(() => window.__ready, null, { timeout: 240000 });
console.log('ready in', (Date.now() - t0) / 1000, 's');
for (const t of times) {
  await p.evaluate((t) => window.__seek(t), t);
  await p.evaluate((t) => window.__seek(t), t);
  await p.screenshot({ path: `shots/${tag}t${String(t).padStart(5, '0')}.png` });
  console.log('shot', t);
}
await b.close(); await server.close();
