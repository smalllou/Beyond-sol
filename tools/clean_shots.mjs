import { chromium } from 'playwright';
import { createServer } from 'vite';
const times = process.argv[2].split(',').map(Number);
const server = await createServer({ server: { port: 5196 }, logLevel: 'error' });
await server.listen();
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +(process.argv[3]||640), height: +(process.argv[4]||360) } });
p.on('pageerror', e => console.log('[pageerror]', e.message));
await p.goto(`http://localhost:5196/?t=${times[0]}&dpr=1`);
await p.waitForFunction(() => window.__ready, null, { timeout: 240000 });
await p.evaluate(() => document.getElementById('btn-hud').click());
for (const t of times) { await p.evaluate((t) => { window.__seek(t); window.__seek(t); }, t); await p.screenshot({ path: `shots/oc${String(t).padStart(5, '0')}.png` }); }
await b.close(); await server.close();
