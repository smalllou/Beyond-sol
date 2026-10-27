// 中文字体子集化：扫描 src/**/*.js 和 index.html 里出现的所有非 ASCII 字符，
// 从完整的 Noto Sans SC（可变字重）裁出 HUD 用的 woff2。改过中文文本后运行：npm run font
import subsetFont from 'subset-font';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'tools/fonts/NotoSansSC.ttf';
const OUT = 'public/assets/fonts/NotoSansSC-hud.woff2';

const files = ['index.html'];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.js')) files.push(p);
  }
})('src');

const chars = new Set();
for (const f of files) for (const c of readFileSync(f, 'utf8')) if (c.codePointAt(0) > 127) chars.add(c);
// 常用补充：数字、全角标点、计量单位
for (const c of '0123456789０１２３４５６７８９，。：；！？、·—…“”‘’（）《》年月日时分秒天光公里度') chars.add(c);
for (let c = 32; c < 127; c++) chars.add(String.fromCharCode(c));

const text = [...chars].sort().join('');
const buf = await subsetFont(readFileSync(SRC), text, { targetFormat: 'woff2' });
writeFileSync(OUT, buf);
console.log(`${files.length} 个文件 · ${chars.size} 个字符 → ${OUT} (${(buf.length / 1024).toFixed(0)} KB)`);
