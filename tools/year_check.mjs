// 年份单调检查：每 0.25 s 采样 TELE.year（HUD 用 Math.floor 显示），断言从 2058 单调不减到 4605；事件年份标签与曲线一致
// 距离检查：星际各章（t ≥ 96 s）距太阳 ≤ 4.2 光年，且 距太阳 + 距比邻星 ≈ 4.2 光年（与 hud.js 同一算法）
// 速度—距离检查：t ≥ 98 s 时 HUD 距离与"对 HUD 速度 × d(年份) 独立积分"的结果相差 < 1%；第二、三章只报告径向速度与 HUD 速度之比
// 用法：node tools/year_check.mjs
import { TELE, EVENTS, DURATION, keyed, velKms, distAU, DIST_K, AU_PER_LY } from '../src/story.js';
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
const D = 4.2;
let maxSun = 0, maxErr = 0;
for (let i = 0; i * 0.25 <= DURATION; i++) {
  const t = i * 0.25; if (t < 96) continue;
  const sun = distAU(t) / AU_PER_LY;
  const acen = Math.max(0.0003, D - sun);   // 同 hud.js 的 t-acen
  maxSun = Math.max(maxSun, sun); maxErr = Math.max(maxErr, Math.abs(sun + acen - D));
  if (sun > D + 1e-9) { console.log(`FAIL: ${t.toFixed(2)} s 距太阳 ${sun.toFixed(4)} 光年 > ${D}`); fail++; }
}
if (maxErr > 0.001) { console.log(`FAIL: 距太阳 + 距比邻星 偏离 ${D} 达 ${maxErr.toFixed(4)} 光年`); fail++; }
const endLY = distAU(DURATION) / AU_PER_LY;
if (Math.abs(endLY - 4.1997) > 1e-4) { console.log(`FAIL: 终点 ${endLY.toFixed(5)} 光年 ≠ 4.1997`); fail++; }
console.log(`距离：星际段距太阳最大 ${maxSun.toFixed(4)} 光年，终点 ${endLY.toFixed(5)} 光年（log ${Math.log10(distAU(DURATION)).toFixed(5)}），距太阳 + 距比邻星 最大偏差 ${maxErr.toFixed(4)} 光年`);

// 独立积分（RK 中点，0.002 s 步长）：只用 HUD 的速度与年份曲线，从 98 s 的 HUD 距离出发
const AU_KM = 1.495978707e8, YR_S = 3.15576e7;
const integ = (ta, tb, d0, dt = 0.002) => { let d = d0; for (let t = ta; t < tb - 1e-9; t += dt) { const u = Math.min(tb, t + dt); d += velKms((t + u) / 2) * (keyed(TELE.year, u) - keyed(TELE.year, t)) * YR_S / AU_KM; } return d; };
let maxRel = 0, at = 0, d = distAU(98), tp = 98;
for (let t = 98.5; t <= DURATION + 1e-9; t += 0.5) {
  d = integ(tp, t, d); tp = t;
  const rel = Math.abs(distAU(t) - d) / d;
  if (rel > maxRel) { maxRel = rel; at = t; }
}
console.log(`速度—距离（t ≥ 98 s）：HUD 距离与速度积分最大相对偏差 ${(maxRel * 100).toFixed(3)}%（${at} s）；星际段校正系数 DIST_K = ${DIST_K.toFixed(5)}`);
if (maxRel > 0.01) { console.log('FAIL: 速度积分与显示距离偏差 ≥ 1%'); fail++; }
for (const [t, ly] of [[126, 0.554], [152, 3.427]]) {
  // 目标值是按"匀加速"估算的参考（信息）；加速段速度与年份都是 smoothstep 曲线，积分值略有不同，以积分为准
  const v = distAU(t) / AU_PER_LY; console.log(`  ${t} s（${Math.floor(keyed(TELE.year, t))}）距太阳 ${v.toFixed(3)} 光年（匀加速估算约 ${ly}，信息）`);
}
// 第三章：速度积分即显示距离（66–98 s 不做校正），报告斜率
const seg = (a, b) => { const dy = keyed(TELE.year, b) - keyed(TELE.year, a), dAU = distAU(b) - distAU(a); return { dAU, dy, kms: dAU * AU_KM / (dy * YR_S) }; };
for (const [a, b] of [[66, 72], [72, 96], [66, 96]]) { const s = seg(a, b); console.log(`  第三章 ${a}–${b} s：${distAU(a).toFixed(1)} → ${distAU(b).toFixed(1)} AU / ${s.dy.toFixed(1)} 年 = 平均径向 ${s.kms.toFixed(1)} km/s；HUD ${velKms(a).toFixed(1)} → ${velKms(b).toFixed(1)} km/s`); }
// 第二章：绕日椭圆，径向速度本就小于日心速度，只报告
for (const [a, b] of [[36, 48], [48, 52], [52, 62], [65, 66]]) { const s = seg(a, b); console.log(`  第二章 ${a}–${b} s（信息）：${distAU(a).toFixed(2)} → ${distAU(b).toFixed(2)} AU / ${s.dy.toFixed(1)} 年 = 平均径向 ${s.kms.toFixed(1)} km/s；HUD 日心速度 ${velKms(a).toFixed(1)} → ${velKms(b).toFixed(1)} km/s`); }
for (const [t, au] of [[72, 30], [86, 87], [95.5, 120]]) { const v = distAU(t); console.log(`  ${t} s 距太阳 ${v.toFixed(1)} AU（目标 ${au}）`); if (Math.abs(v - au) / au > 0.03) { console.log(`FAIL: ${t} s 距离偏离 ${au} AU`); fail++; } }
// 速度无假下跌：96–100 s 单调不减
let pv = 0; for (let t = 95; t <= 100; t += 0.01) { const v = velKms(t); if (t > 96 && v < pv - 1e-6) { console.log(`FAIL: ${t.toFixed(2)} s 速度下跌 ${pv.toFixed(2)} → ${v.toFixed(2)}`); fail++; break; } pv = v; }
for (const t of [0, 36, 48, 52, 62, 65, 66, 72, 96, 126, 152, 171, 174]) console.log(`  ${t}s → ${keyed(TELE.year, t).toFixed(2)}`);
console.log(`${n} 个采样 · ${y0} → ${y1} · ${fail ? 'YEAR CHECK FAIL' : 'YEAR CHECK OK（单调不减 · 速度—距离一致）'}`);
process.exit(fail ? 1 : 0);
