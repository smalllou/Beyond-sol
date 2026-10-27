// 剧本：章节、字幕、事件日志、遥测关键帧。全部以影片时间（秒）为索引。
export const DURATION = 174;

export const CHAPTERS = [
  { id: 1, t0: 0,   t1: 36,  en: 'THE WANDERING EARTH',     zh: '流浪地球',   card: null,                      years: '2058 · 1 AU' },
  { id: 2, t0: 36,  t1: 66,  en: 'THE SOLAR SYSTEM',        zh: '太阳系',     card: [36, 40.5],               years: '2058 — 2078 · 1 → 9 AU' },
  { id: 3, t0: 66,  t1: 96,  en: 'BEYOND THE OUTER PLANETS', zh: '超越外行星', card: [66, 70.5],               years: '2080 — 2105 · 12 → 120 AU' },
  { id: 4, t0: 96,  t1: 126, en: 'INTERSTELLAR VOYAGE',     zh: '星际航行',   card: [96, 100.5],              years: '2105 — 2605 · ACCELERATION · 0 → 0.22% c' },   // 原著：飞离木星后发动机即连续开动 500 年（加速期自约 2077 年起）；卡片放不下这条注，见 README
  { id: 5, t0: 126, t1: 152, en: 'THE MILKY WAY',           zh: '银河系',     card: [126, 130.5],             years: '2605 — 3905 · COAST · ORION SPUR' },
  { id: 6, t0: 152, t1: 174, en: 'A NEW SUN',               zh: '新太阳',     card: [152, 156.5],             years: '3905 — 4605 · 减速与泊入 · 4.2 LY' },   // 原著：减速 500 年，航行 2400 年到达后再用 100 年泊入；这里 700 年 = 减速约 500 年 + 泊入约 200 年,
];

export function chapterAt(t) {
  for (let i = CHAPTERS.length - 1; i >= 0; i--) if (t >= CHAPTERS[i].t0) return CHAPTERS[i];
  return CHAPTERS[0];
}

// 字幕：[开始, 结束, 中文, English]
export const SUBS = [
  [1.0, 8.6,  '太阳正在死去。一万两千台聚变发动机，把它的光变成我们离开的路。（原著口径；电影为一万座）', 'The Sun is dying. Twelve thousand fusion engines turn its light into our way out. (Novel\u2019s count; 10,000 in the films)'],
  [9.2, 14.8, '点火从背阳的半球开始，一台接一台，向整颗星球蔓延。（刹车时代始于 2044 年，此时自转已极慢）', 'Ignition starts on the night side and spreads, engine by engine, across the world. (The braking era began in 2044; by now the spin is very slow.)'],
  [15.4, 23.6,'太空电梯：从赤道到地球同步轨道，三万六千公里。（2044 年，太空电梯危机前）', 'The space elevator: 36,000 km from the equator to geostationary orbit. (2044, before the Space Elevator Crisis)'],
  [24.2, 29.6,'方舟号国际空间站：同步轨道上的港口，地球的出口。（2044 年）', 'The Ark International Space Station: a harbour in geostationary orbit, Earth\u2019s way out. (2044)'],
  [30.2, 35.6,'领航员国际空间站在前方领航。我们带着整个世界出发。（方舟号 2044 年坠毁后，2048 年起建造）', 'The Navigator ISS leads the way. We leave with the whole world on board. (built from 2048, after the Ark fell in 2044)'],
  [41.0, 45.0,'一颗星球，驶出养育它的太阳系。', 'One planet, sailing out through the system that raised it.'],
  [45.4, 51.6,'在身后，太阳剧烈抽搐：耀斑、日珥与等离子风暴。', 'Behind us the Sun convulses — flares, loops and storms of plasma.'],
  [52.2, 55.4,'木星的引力弯折航线，把我们甩向更远的地方。', 'Jupiter bends our course and flings us outward.'],
  [55.8, 59.4,'领航员号撞向木星，点燃了它。冲击波把我们推了出去。', 'The Navigator dives into Jupiter and sets it alight. The shockwave pushes us out.'],
  [64.8, 68.8,'身后，太阳氦闪。那是我们最后一次看见温暖的阳光。', 'Behind us, the Sun\u2019s helium flash — the last warm light we will see.'],
  [71.0, 76.0,'海王星。在这里，阳光弱了九百倍。', 'Neptune. Sunlight here is nine hundred times weaker.'],
  [76.6, 85.4,'柯伊伯带：冰、黑暗，和寂静。', 'The Kuiper belt: ice, darkness and silence.'],
  [89.6, 95.9,'一百二十个天文单位外，太阳风停了下来。我们越过日球层顶。', 'At 120 AU the solar wind stalls. We cross the heliopause.'],
  [101.0, 106.4,'领航员号留在了木星。从此，地球独自航行。', 'The Navigator stayed behind at Jupiter. From here on, Earth sails alone.'],
  [106.8, 115.6,'五百年的加速。二十代人，在冰封的天空下出生。', 'Five hundred years of acceleration. Twenty generations born under frozen skies.'],
  [116.0, 125.6,'前方，比邻星一年比一年明亮。', 'Ahead, Proxima Centauri grows brighter every year.'],
  [131.0, 137.6,'退后一步，整段航程只是几光年长的一条细线。', 'Pull back, and the whole voyage is a line a few light-years long.'],
  [138.0, 144.6,'我们的邻居：猎户臂，一条由恒星与气体组成的小旋臂。', 'Our neighbourhood: the Orion Spur, a minor arm of stars and gas.'],
  [145.0, 151.6,'再往外，是四千亿颗太阳。银河系。', 'And beyond it, four hundred billion suns. The Milky Way.'],
  [157.0, 163.4,'比邻星，4.2 光年。一颗新的太阳。', 'Proxima Centauri, 4.2 light-years away. A new sun.'],
  [164.6, 169.8,'离开二十五个世纪之后。', 'Twenty-five centuries after we left.'],
];

// 事件日志：[时间, 年份标签（= TELE.year 在该时刻的取整，与 HUD 年份一致）, 文本, 警告?]
export const EVENTS = [
  [0.5,   '2058', 'MOSS 唤醒 · 全球发动机网络自检完成'],
  [2.5,   '2058', '点火 · 重型阵列 25 / 25 台点亮'],
  [6.0,   '2058', '点火前沿推进 · 背阳半球'],
  [11.0,  '2058', '赤道转向阵列 · 推力同步'],
  [18.0,  '2058', '2044 档案 · 电梯攀爬舱 07 · 离开锚点'],
  [25.0,  '2058', '2044 档案 · 方舟号 · 同步轨道船坞 · 在建'],
  [31.0,  '2058', '领航员国际空间站 · 伴航就位'],
  [46.5,  '2067', '日冕物质抛射 · 磁层护盾吸收', true],
  [52.0,  '2075', '木星引力突增 · 地壳形变 · 5,000 余座发动机停机', true],
  [53.0,  '2075', '坠向木星 · 逼近洛希极限（约 1.1×10⁵ km）', true],
  [56.0,  '2076', '领航员号信号中断', true],
  [57.0,  '2076', '冲击波推离 · 脱出洛希极限', true],
  [60.2,  '2077', '飞离木星 · 全球发动机重新点火'],
  [61.0,  '2077', '土星环面穿越 · 冰粒撞击可控'],
  [62.0,  '2078', '叛军起事 · 质疑氦闪预测 · 联合政府失守', true],
  [63.4,  '2078', '五千多名地球派（含最高执政官与士兵）被处决于海冰之上', true],
  [64.8,  '2078', '太阳氦闪爆发 · 预测被证实 · 海冰上的地球派已全部罹难', true],
  [65.8,  '2079', '发动机重新点火 · 驶向外太阳系'],
  [72.0,  '2084', '海王星轨道 · 30 AU'],
  [78.0,  '2087', '进入柯伊伯带 · 碎冰密度上升'],
  [86.0,  '2097', '终端激波 · 太阳风降至亚声速'],
  [95.5,  '2104', '越过日球层顶 · 进入星际介质'],
  [102.0, '2157', '加速段 · 推力 102.7%'],
  [108.0, '2281', '第 9 代 · 地下城运转正常'],
  [113.0, '2404', '弓形激波稳定 · 星际介质 0.2 原子/cm³'],
  [119.0, '2536', '导航锁定 · 比邻星 · 4.2 光年'],
  [127.0, '2610', '加速结束 · 发动机关闭 · 滑行 1300 年'],
  [132.0, '2780', '远距巡天 · 本地泡'],
  [140.0, '3329', '猎户臂 · 距银心 26,000 光年'],
  [147.0, '3779', '银河全景 · 外侧晕视角'],
  [152.5, '3906', '流浪时代Ⅱ · 赤道转向阵列点火 · 地球重新自转'],
  [155.0, '3951', '发动机掉转方向 · 减速点火', true],
  [165.0, '4439', '泊入轨道 · 进入比邻星引力范围'],
  [171.0, '4605', '旅程结束 · 欢迎来到新家园'],
];

// 关键帧插值工具
export function keyed(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, a] = keys[i - 1], [t1, b] = keys[i];
      const u = (t - t0) / (t1 - t0);
      const s = u * u * (3 - 2 * u);
      return a + (b - a) * s;
    }
  }
  return keys[keys.length - 1][1];
}

export const TELE = {
  // 推力 %：木星危机部分停机（52 s）；叛乱处决期间全部关闭（62–65.5 s）；滑行 1300 年关闭（127–151.5 s）；155 s 掉头后减速
  thrust: [[0, 0], [2, 4], [14, 62], [24, 100], [51.4, 101], [52.4, 58], [59.6, 58], [61.0, 100], [61.6, 100], [62.0, 0], [65.5, 0], [66.5, 100], [102, 102.7], [126, 100], [127, 0], [151.5, 0], [153, 0], [155.5, 104], [172, 70]],
  engines: [[0, 0], [2, 25], [14, 8160], [22, 12000], [51.4, 12000], [52.4, 7000], [59.6, 7000], [61.0, 12000], [61.6, 12000], [62.0, 0], [65.5, 0], [66.5, 12000], [126, 12000], [127, 0], [151.5, 0], [153, 0], [155.5, 12000]],
  // 速度（日心）：vel 为 km/s（t ≤ 98 s），velc 为 %c（t ≥ 98 s），98 s 处 23.98 km/s = 0.008 %c 衔接（两段分开插值，避免单位混插造成假下跌）
  // 第三章 21.4 → 19.7 km/s：12 AU（2080）→ 30 AU（2084，海王星）→ 120 AU（2105，日球层顶）
  // 巡航 0.221 %c ≈ 663 km/s：4.2 光年 ÷（加速 500 年 / 2 + 滑行 1300 年 + 减速 700 年 / 2）
  // （原著写"光速的千分之五"，但 0.5 %c 跑完同样的时间表约 9 光年，与比邻星距离不自洽）
  vel: [[0, 29.8], [22, 30.6], [36, 31.4], [54, 38], [58, 34], [66, 21.4], [96, 19.7], [98, 23.98]],
  velc: [[98, 0.008], [126, 0.221], [152, 0.221], [171, 0]],
  // 距太阳（AU，对数插值）：只用于太阳系内（t ≤ 66 s，绕日椭圆，径向距离不等于速度积分）；t ≥ 66 s 由 distAU() 对速度积分得到
  logAU: [[0, 0], [36, 0.05], [45, 0.5], [55, 0.72], [62, 0.95], [65, 0.96], [66, 1.08]],
  // 2058 出发 · 2058–2078 逃逸（绕日加速 → 2075 木星危机 → 2078 氦闪）· 2080–2105 外太阳系 · 2105–2605 加速 · 2605–3905 滑行 · 3905–4605 减速与泊入
  // 单调不减；HUD 年份、太阳系世界的行星公转与航迹共用这条曲线（yearAt）
  year: [[0, 2058], [36, 2058], [48, 2068], [52, 2075], [62, 2078], [65, 2078], [66, 2080], [72, 2084], [96, 2105], [126, 2605], [152, 3905], [171, 4605], [174, 4605]],
  temp: [[0, 14], [36, 6], [60, -38], [96, -66], [110, -76], [152, -78], [165, -72], [174, -40]],
  steer: [[0, 0], [10, 0], [16, 100], [33.5, 100], [36, 0], [152, 0], [154.5, 100], [174, 100]],
  mag: [[0, 100], [46, 100], [48, 86], [52, 98], [96, 92], [126, 82], [174, 88]],
  core: [[0, 0.5], [14, 6], [24, 9.4], [174, 9.5]],
  res: [[0, 0], [8, 7.2], [40, 7.6], [110, 8.25], [174, 8.1]],
};

// 速度（km/s），两段关键帧拼接
export const C_KMS = 299792.458;
export const velKms = (t) => (t < 98 ? keyed(TELE.vel, t) : keyed(TELE.velc, t) / 100 * C_KMS);

// 距离：t ≥ 66 s 对 velKms × d(year) 做累积积分（步长 0.01 s，中点法）；
// 星际段（t ≥ 98 s）乘以常数 DIST_K，使终点恰为 4.1997 光年（比邻星 4.2 光年，泊入后相距约 0.0003 光年）
const AU_KM = 1.495978707e8, YR_S = 3.15576e7;
export const AU_PER_LY = 63241.077;
export const D_END_AU = 4.1997 * AU_PER_LY;
const INT_T0 = 66, INT_DT = 0.01, INT_N = Math.round((DURATION - INT_T0) / INT_DT);
const RAW = new Float64Array(INT_N + 1);
RAW[0] = Math.pow(10, 1.08);
for (let i = 0; i < INT_N; i++) {
  const ta = INT_T0 + i * INT_DT, tb = ta + INT_DT;
  RAW[i + 1] = RAW[i] + velKms((ta + tb) / 2) * (keyed(TELE.year, tb) - keyed(TELE.year, ta)) * YR_S / AU_KM;
}
const rawAt = (t) => { const x = Math.min(INT_N, Math.max(0, (t - INT_T0) / INT_DT)), i = Math.min(INT_N - 1, Math.floor(x)), f = x - i; return RAW[i] + (RAW[i + 1] - RAW[i]) * f; };
const RAW98 = rawAt(98);
export const DIST_K = (D_END_AU - RAW98) / (RAW[INT_N] - RAW98);
// 纯速度积分（未校正），供 tools/year_check.mjs 对比
export const integratedAU = (t) => (t <= INT_T0 ? Math.pow(10, keyed(TELE.logAU, t)) : rawAt(t));
// HUD 显示的距太阳（AU）
export function distAU(t) {
  if (t <= INT_T0) return Math.pow(10, keyed(TELE.logAU, t));
  const r = rawAt(t);
  return t <= 98 ? r : RAW98 + (r - RAW98) * DIST_K;
}

export const REGIONS = [
  [0, '内太阳系 · 地球轨道', 'INNER SYS'],
  [44, '内太阳系 · 小行星带', 'INNER SYS'],
  [52, '木星系统', 'OUTER SYS'],
  [60, '土星系统', 'OUTER SYS'],
  [70, '外行星 · 海王星', 'OUTER SYS'],
  [77, '柯伊伯带', 'KUIPER'],
  [88, '日球层顶', 'HELIOPAUSE'],
  [96, '星际介质 · 本地云', 'INTERSTELLAR'],
  [126, '本地泡 · 猎户臂', 'GALACTIC'],
  [152, '比邻星系 · 4.2 光年', 'PROXIMA'],
];

export const TAGS = [
  // [时间, 推进标签, 导航标签, 推进警告?, 导航警告?]
  [0, 'STANDBY', 'PARKED'],
  [1.5, 'IGNITION', 'DEPARTURE', true],
  [24, 'FULL THRUST', 'DEPARTURE'],
  [38, 'CRUISE', 'TIME COMPRESS'],
  [46, 'SHIELD', 'TIME COMPRESS', true],
  [52, 'ENGINE FAULT', 'ROCHE LIMIT', true, true],
  [57, 'ENGINE FAULT', 'GRAVITY ASSIST', true],
  [60, 'RE-IGNITION', 'GRAVITY ASSIST', true],
  [61, 'CRUISE', 'RING CROSSING'],
  [62, 'ENGINES OFF', 'REBELLION', true, true],
  [65.5, 'RE-IGNITION', 'OUTER SYSTEM', true],
  [70, 'CRUISE', 'OUTER SYSTEM'],
  [86, 'CRUISE', 'HELIOPAUSE', false, true],
  [100, 'ACCELERATE', 'INTERSTELLAR'],
  [127, 'COAST', 'SURVEY'],
  [152.5, 'SPIN-UP', 'TURNAROUND', true],
  [155, 'REVERSE BURN', 'CAPTURE', true, true],
  [168, 'TRIM', 'ARRIVAL'],
];

// 影片时间 → 年份（HUD、太阳系世界的行星公转与航迹共用）
export const yearAt = (t) => keyed(TELE.year, t);
