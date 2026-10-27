// 生成 src/data/near-stars.js：HYG 星表（v4.4，CC BY-SA 4.0，codeberg.org/astronexus/hyg）里距太阳 100 光年内的恒星。
// 坐标从赤道直角坐标（秒差距）转到银道坐标（光年）：X 指向银心、Y 指向银经 90°、Z 指向银北极。
// 用法：node tools/near-stars.mjs [hyg_v44.csv.gz 路径]（不给路径时自动下载）
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const URL = 'https://codeberg.org/astronexus/hyg/media/branch/main/data/hyg/CURRENT/hyg_v44.csv.gz';
const PC2LY = 3.26156, MAX_LY = 100;
// J2000 赤道 → 银道旋转矩阵
const M = [[-0.0548755604, -0.8734370902, -0.4838350155], [0.4941094279, -0.4448296300, 0.7469822445], [-0.8676661490, -0.1980763734, 0.4559837762]];

const gz = process.argv[2] ? readFileSync(process.argv[2]) : Buffer.from(await (await fetch(URL)).arrayBuffer());
const lines = gunzipSync(gz).toString('utf8').split('\n');
const parse = (l) => { const out = []; let cur = '', q = false; for (const c of l) { if (c === '"') q = !q; else if (c === ',' && !q) { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; };
const head = parse(lines[0]); const ix = (k) => head.indexOf(k);
const I = { id: ix('id'), proper: ix('proper'), dist: ix('dist'), absmag: ix('absmag'), ci: ix('ci'), x: ix('x'), y: ix('y'), z: ix('z'), spect: ix('spect') };
const stars = [];
for (let i = 1; i < lines.length; i++) {
  if (!lines[i]) continue;
  const r = parse(lines[i]);
  const d = +r[I.dist];
  if (!(d > 0) || d * PC2LY > MAX_LY) continue;          // 跳过太阳（dist 0）和距离未知（100000）的条目
  const e = [+r[I.x], +r[I.y], +r[I.z]];
  const g = M.map(row => (row[0] * e[0] + row[1] * e[1] + row[2] * e[2]) * PC2LY);
  const ci = r[I.ci] === '' ? 1.0 : +r[I.ci];
  stars.push({ g, ci, mag: +r[I.absmag], name: r[I.proper] });
}
stars.sort((a, b) => a.mag - b.mag);
const flat = []; const names = {};
stars.forEach((s, k) => { flat.push(+s.g[0].toFixed(2), +s.g[1].toFixed(2), +s.g[2].toFixed(2), +s.ci.toFixed(2), +s.mag.toFixed(2)); if (s.name) names[s.name] = k; });
mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/near-stars.js', `// 自动生成：node tools/near-stars.mjs。HYG v4.4（CC BY-SA 4.0，David Nash / astronexus）中距太阳 ${MAX_LY} 光年内的 ${stars.length} 颗恒星。
// 每颗 5 个数：银道坐标 X（指向银心）、Y（银经 90°）、Z（银北极），单位光年；B−V 色指数；绝对星等。按绝对星等从亮到暗排列。
export const NEAR_STARS = new Float32Array([${flat.join(',')}]);
export const NEAR_NAMES = ${JSON.stringify(names)};
`);
console.log(`${stars.length} 颗恒星 → src/data/near-stars.js`);
