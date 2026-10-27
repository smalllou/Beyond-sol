import { chromium } from 'playwright';
import { createServer } from 'vite';
process.chdir('/workspace/work/beyond-sol/beyond-sol');
const server = await createServer({ root: process.cwd(), server: { port: 5198 }, logLevel: 'error' });
await server.listen();
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
p.on('pageerror', e => console.log('[pageerror]', e.message));
await p.goto(`http://localhost:5198/?t=40&dpr=1`);
await p.waitForFunction(() => window.__ready, null, { timeout: 240000 });
const cases = [[40, 3, 0.3], [40, 2.2, 2.4], [47, 3, 1.2], [51, 3, 0.4], [44, 14, 0.8]];
let i = 0;
for (const [t, d, az] of cases) {
  await p.evaluate(([t, d, az]) => {
    window.__seek(t);
    if (!window.__dbg.controls) document.getElementById('btn-explore').click();
    window.__seek(t);
    const W = window.__dbg.world, c = window.__dbg.controls, e = W.earth.position;
    c.target.copy(e); W.camera.position.set(e.x + Math.cos(az) * d, e.y + d * 0.25, e.z + Math.sin(az) * d);
    window.__seek(t); window.__seek(t);
  }, [t, d, az]);
  await p.screenshot({ path: `shots/ex${i++}.png` });
}
await b.close(); await server.close();
