// 冒烟测试：加载页面 → 点击开始 → 确认影片时间在前进 → 在三个世界的探索模式里飞遍所有目的地
// 有页面异常、或影片时间没有前进时以非 0 退出。用法：node tools/smoke.mjs
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
mkdirSync('shots', { recursive: true });
const server = await createServer({ server: { port: 5198 }, logLevel: 'error' }); await server.listen();
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
p.on('pageerror', e => { errors.push(e.message); console.log('[pageerror]', e.message, (e.stack || '').split('\n').slice(0, 4).join(' | ')); });
p.on('console', m => { if (m.type() === 'error') { const s = m.text(); if (!/favicon|GPU stall|WebGL-/.test(s)) { errors.push(s); console.log('[error]', s.slice(0, 300)); } } });
let code = 0;
try {
  await p.goto('http://localhost:5198/?dpr=1');
  await p.waitForFunction(() => window.__ready, null, { timeout: 240000 });
  await p.screenshot({ path: 'shots/smoke_loader.png' });
  await p.click('#l-go');
  const t0 = (await p.evaluate(() => window.__state())).t;
  await p.waitForTimeout(6000);
  const t1 = (await p.evaluate(() => window.__state())).t;
  await p.screenshot({ path: 'shots/smoke_play.png' });
  console.log('film time', t0.toFixed(3), '→', t1.toFixed(3), '| label', await p.textContent('#time'));
  if (!(t1 > t0) || t1 < 0) { console.log('FAIL: 影片时间没有前进'); code = 1; }
  // 三个世界：地球(6s)、太阳系(44s)、银河(140s)
  for (const t of [6, 44, 140]) {
    await p.click('#btn-film');
    await p.evaluate((t) => window.__seek(t), t);
    await p.click('#btn-explore');
    await p.waitForTimeout(500);
    const n = await p.locator('#dest-list li').count();
    for (let i = 1; i <= n; i++) {
      await p.click(`#dest-list li:nth-child(${i})`);
      await p.waitForTimeout(1200);
    }
    console.log(`explore @${t}s: ${n} 个目的地`);
    await p.screenshot({ path: `shots/smoke_explore_${t}.png` });
  }
} catch (e) { console.log('FAIL:', e.message); code = 1; }
if (errors.length) { console.log(`FAIL: ${errors.length} 个页面错误`); code = 1; }
console.log(code ? 'SMOKE FAIL' : 'SMOKE OK');
await b.close(); await server.close();
process.exit(code);
