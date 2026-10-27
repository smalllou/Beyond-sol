// 年份单调检查：每 0.25 s 采样 TELE.year（HUD 用 Math.floor 显示），断言从 2058 单调不减到 4605；事件年份标签与曲线一致
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
for (const t of [0, 36, 48, 52, 62, 65, 66, 96, 126, 152, 171, 174]) console.log(`  ${t}s → ${keyed(TELE.year, t).toFixed(2)}`);
console.log(`${n} 个采样 · ${y0} → ${y1} · ${fail ? 'YEAR CHECK FAIL' : 'YEAR CHECK OK（单调不减）'}`);
process.exit(fail ? 1 : 0);
