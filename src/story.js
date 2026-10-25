// 剧本：章节、字幕、事件日志、遥测关键帧。全部以影片时间（秒）为索引。
export const DURATION = 174;

export const CHAPTERS = [
  { id: 1, t0: 0,   t1: 36,  en: 'THE WANDERING EARTH',     zh: '流浪地球',   card: null,                      years: '2078 · 1 AU' },
  { id: 2, t0: 36,  t1: 66,  en: 'THE SOLAR SYSTEM',        zh: '太阳系',     card: [36, 40.5],               years: '2079 — 2093 · 1 → 10 AU' },
  { id: 3, t0: 66,  t1: 96,  en: 'BEYOND THE OUTER PLANETS', zh: '超越外行星', card: [66, 70.5],               years: '2101 — 2156 · 30 → 120 AU' },
  { id: 4, t0: 96,  t1: 126, en: 'INTERSTELLAR VOYAGE',     zh: '星际航行',   card: [96, 100.5],              years: '2160 — 2580 · 0.002 → 1.6 LY' },
  { id: 5, t0: 126, t1: 152, en: 'THE MILKY WAY',           zh: '银河系',     card: [126, 130.5],             years: 'ORION SPUR · 26,000 LY FROM THE CORE' },
  { id: 6, t0: 152, t1: 174, en: 'A NEW SUN',               zh: '新太阳',     card: [152, 156.5],             years: '4578 · ALPHA CENTAURI · 4.37 LY' },
];

export function chapterAt(t) {
  for (let i = CHAPTERS.length - 1; i >= 0; i--) if (t >= CHAPTERS[i].t0) return CHAPTERS[i];
  return CHAPTERS[0];
}

// 字幕：[开始, 结束, 中文, English]
export const SUBS = [
  [1.0, 8.6,  '太阳正在死去。一万台聚变发动机，把它的光变成我们离开的路。', 'The Sun is dying. Ten thousand fusion engines turn its light into our way out.'],
  [9.2, 14.8, '点火从背阳的半球开始，一台接一台，向整颗星球蔓延。', 'Ignition starts on the night side and spreads, engine by engine, across the world.'],
  [15.4, 23.6,'太空电梯：从赤道到地球同步轨道，三万六千公里。', 'The space elevator: 36,000 km from the equator to geostationary orbit.'],
  [24.2, 29.6,'天枢站：同步轨道上的港口，也是三百万人的家。', 'Tianshu Station: a harbour on the geostationary ring, and home to three million.'],
  [30.2, 35.6,'领航员号舰队在前方开路。我们带着整个世界出发。', 'The Navigator fleet clears the way ahead. We leave with the whole world on board.'],
  [41.0, 45.0,'一颗星球，驶出养育它的星系。', 'One planet, sailing out through the system that raised it.'],
  [45.4, 51.6,'在身后，太阳剧烈抽搐：耀斑、日珥与等离子风暴。', 'Behind us the Sun convulses — flares, loops and storms of plasma.'],
  [52.2, 59.4,'木星的引力弯折航线，把我们甩向更远的地方。', 'Jupiter bends our course and flings us outward.'],
  [60.0, 65.6,'土星环从身旁掠过。那是我们最后一次看见温暖的阳光。', 'Saturn\u2019s rings fall behind — the last warm light we will see.'],
  [71.0, 76.0,'海王星。在这里，阳光弱了九百倍。', 'Neptune. Sunlight here is nine hundred times weaker.'],
  [76.6, 85.4,'柯伊伯带：冰、黑暗，和寂静。', 'The Kuiper belt: ice, darkness and silence.'],
  [86.0, 95.4,'一百二十个天文单位外，太阳风停了下来。我们越过日球层顶。', 'At 120 AU the solar wind stalls. We cross the heliopause.'],
  [101.0, 106.4,'星球前方，护航舰队安静地航行。', 'Ahead of the planet, the escort fleet sails on in silence.'],
  [106.8, 115.6,'四个世纪。上百代人，在冰封的天空下出生。', 'Four centuries. A hundred generations born under frozen skies.'],
  [116.0, 125.6,'前方，半人马座 α 一年比一年明亮。', 'Ahead, Alpha Centauri grows brighter every year.'],
  [131.0, 137.6,'退后一步，整段航程只是几光年长的一条细线。', 'Pull back, and the whole voyage is a line a few light-years long.'],
  [138.0, 144.6,'我们的邻居：猎户臂，一条由恒星与气体组成的小旋臂。', 'Our neighbourhood: the Orion Spur, a minor arm of stars and gas.'],
  [145.0, 151.6,'再往外，是四千亿颗太阳。银河系。', 'And beyond it, four hundred billion suns. The Milky Way.'],
  [157.0, 163.4,'离开二十五个世纪之后。', 'Twenty-five centuries after we left.'],
  [164.0, 169.6,'半人马座 α。一颗新的太阳。', 'Alpha Centauri. A new sun.'],
];

// 事件日志：[时间, T+标签, 文本, 警告?]
export const EVENTS = [
  [0.5,  'T+0:00', 'MOSS 唤醒 · 全球发动机网络自检完成'],
  [2.5,  'T+0:02', '点火 · 重型阵列 25 / 25 台点亮'],
  [6.0,  'T+0:06', '点火前沿推进 · 背阳半球'],
  [11.0, 'T+0:11', '赤道转向阵列 · 推力同步'],
  [16.0, 'T+0:16', '电梯攀爬舱 07 · 离开锚点'],
  [25.0, 'T+0:25', '天枢站 · 双环反向旋转 0.92 g'],
  [31.0, 'T+0:31', '领航员号 · 舰队编队完成'],
  [38.0, 'T+1:02', '时间压缩启动 · 1 年 : 3 秒'],
  [46.5, 'T+1:12', '日冕物质抛射 · 磁层护盾吸收', true],
  [53.0, 'T+1:17', '木星引力弹射 · 近点 3.1×10⁵ km'],
  [57.0, 'T+1:21', '洛希极限告警 · 已偏离', true],
  [61.0, 'T+1:25', '土星环面穿越 · 冰粒撞击可控'],
  [72.0, 'T+1:36', '海王星轨道 · 30 AU'],
  [78.0, 'T+1:42', '进入柯伊伯带 · 碎冰密度上升'],
  [88.0, 'T+1:52', '终端激波 · 太阳风降至亚声速'],
  [92.0, 'T+1:56', '越过日球层顶 · 进入星际介质'],
  [102.0,'T+2:06', '巡航 · 推力 102.7%'],
  [108.0,'T+2:12', '第 41 代 · 地下城运转正常'],
  [113.0,'T+2:17', '弓形激波稳定 · 星际介质 0.2 原子/cm³'],
  [119.0,'T+2:23', '半人马座 α A · 视星等 −6.1'],
  [132.0,'T+2:36', '远距巡天 · 本地泡'],
  [140.0,'T+2:44', '猎户臂 · 距银心 26,000 光年'],
  [147.0,'T+2:51', '银河全景 · 外侧晕视角'],
  [158.0,'T+3:02', '掉头 · 减速点火 · 全功率反推', true],
  [165.0,'T+3:09', '捕获 · 进入半人马座 α 引力范围'],
  [171.0,'T+3:15', '旅程结束 · 欢迎来到新家园'],
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
  // 推力 %
  thrust: [[0, 0], [2, 4], [14, 62], [24, 100], [102, 102.7], [150, 96], [157, 40], [160, 104], [172, 70]],
  engines: [[0, 0], [2, 25], [14, 6800], [22, 10000]],
  // 速度：前四章 km/s，之后为 %c
  vel: [[0, 29.8], [22, 30.6], [36, 31.4], [54, 38], [58, 52], [66, 50], [96, 62], [100, 0.2], [110, 0.5]],
  // 距太阳（AU，对数插值）
  logAU: [[0, 0], [36, 0.05], [45, 0.5], [55, 0.72], [64, 0.98], [72, 1.48], [86, 1.8], [96, 2.08], [104, 3.4], [126, 5.0], [152, 5.36], [160, 5.44]],
  year: [[0, 2078], [36, 2079], [64, 2093], [66, 2101], [96, 2156], [100, 2160], [126, 2580], [152, 4300], [158, 4578], [174, 4578]],
  temp: [[0, 14], [36, 6], [60, -38], [96, -66], [110, -76], [152, -78], [165, -72], [174, -40]],
  steer: [[0, 0], [10, 0], [16, 100], [100, 100], [104, 45], [174, 45]],
  mag: [[0, 100], [46, 100], [48, 86], [52, 98], [96, 92], [126, 82], [174, 88]],
  core: [[0, 0.5], [14, 6], [24, 9.4], [174, 9.5]],
  res: [[0, 0], [8, 7.2], [40, 7.6], [110, 8.25], [174, 8.1]],
};

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
  [152, '半人马座 α 星系', 'ALPHA CEN'],
];

export const TAGS = [
  // [时间, 推进标签, 导航标签, 推进警告?, 导航警告?]
  [0, 'STANDBY', 'PARKED'],
  [1.5, 'IGNITION', 'DEPARTURE', true],
  [24, 'FULL THRUST', 'DEPARTURE'],
  [38, 'CRUISE', 'TIME COMPRESS'],
  [46, 'SHIELD', 'TIME COMPRESS', true],
  [52, 'CRUISE', 'GRAVITY ASSIST', false, true],
  [62, 'CRUISE', 'RING CROSSING'],
  [70, 'CRUISE', 'OUTER SYSTEM'],
  [86, 'CRUISE', 'HELIOPAUSE', false, true],
  [100, 'CRUISE', 'INTERSTELLAR'],
  [128, 'CRUISE', 'SURVEY'],
  [156, 'REVERSE BURN', 'CAPTURE', true, true],
  [168, 'TRIM', 'ARRIVAL'],
];
