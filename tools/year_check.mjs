// 年份单调检查：每 0.25 s 采样 TELE.year（HUD 用 Math.floor 显示），断言从 2058 单调不减到 4605；事件年份标签与曲线一致
// 另检查距离遥测：星际各章（t ≥ 96 s）距太阳 ≤ 4.2 光年，且 距太阳 + 距比邻星 ≈ 4.2 光年（与 hud.js 同一算法）
// 用法：node tools/year_check.mjs
import { TELE, EVENTS, DURATION, keyed } from '../src/story.js';
let prev = -Infinity, fail = 0, n = 0;
for (let i = 0; i * 0.25 <= DURATION; i++) {
  const t = i * 0.25, y = Math.floor(keyed(TELE.year, t)); n++;
  if (y < prev) { console.log(`FAIL: ${t.toFixed(2)} s 年份 ${y} < ${prev}`); fail++; }
  prev = y;
}
const y0 = Math.floor(keyed(TELE.year, 0)), y1 = Math.floor(keyed(TELE.year, DURATION));
if (y0 !== 2058 || y1 !== 4605) { console.log(`FAIL: 起止 ${y0} → ${y1}`); fail++; }
for (const [t, lab] of EVENTS) if (String(Math.floor(keyed(TELE.year, t))) !== lab) { console.log(`FAIL: 事件 ${t}s 标签 ${lab}`); fail++; }
for (let i = 1; i < EVENTS.length; i++) if (EVENTS[i][0] < EVENTS[i - 1][0]) { console.log('FAIL: 事件未按时间排序', EVENTS[i][0]); fail++; }
const AU_LY = 63241, D = 4.2;
let maxSun = 0, maxErr = 0;
for (let i = 0; i * 0.25 <= DURATION; i++) {
  const t = i * 0.25; if (t < 96) continue;
  const sun = Math.pow(10, keyed(TELE.logAU, t)) / AU_LY;
  const acen = t >= 152 && t > 165 ? 0.0003 : Math.max(0, D - sun);   // 同 hud.js 的 t-acen
  maxSun = Math.max(maxSun, sun); maxErr = Math.max(maxErr, Math.abs(sun + acen - D));
  if (sun > D + 1e-9) { console.log(`FAIL: ${t.toFixed(2)} s 距太阳 ${sun.toFixed(4)} 光年 > ${D}`); fail++; }
}
if (maxErr > 0.001) { console.log(`FAIL: 距太阳 + 距比邻星 偏离 ${D} 达 ${maxErr.toFixed(4)} 光年`); fail++; }
console.log(`距离：星际段距太阳最大 ${maxSun.toFixed(4)} 光年（174 s），距太阳 + 距比邻星 最大偏差 ${maxErr.toFixed(4)} 光年`);
for (const t of [0, 36, 48, 52, 62, 65, 66, 96, 126, 152, 171, 174]) console.log(`  ${t}s → ${keyed(TELE.year, t).toFixed(2)}`);
console.log(`${n} 个采样 · ${y0} → ${y1} · ${fail ? 'YEAR CHECK FAIL' : 'YEAR CHECK OK（单调不减）'}`);
process.exit(fail ? 1 : 0);
