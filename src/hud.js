// 仪表盘：把遥测、字幕、事件日志、章节条写进 DOM
import { CHAPTERS, SUBS, EVENTS, TELE, REGIONS, TAGS, DURATION, keyed, chapterAt } from './story.js';

const $ = (id) => document.getElementById(id);
const fmt = (x, d = 1) => x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const pad = (n) => String(n).padStart(2, '0');

export class HUD {
  constructor({ onSeek, onPlay }) {
    this.el = $('hud');
    // 发动机阵列方格
    const grid = $('eng-grid');
    this.cells = [];
    for (let i = 0; i < 100; i++) { const c = document.createElement('i'); grid.appendChild(c); this.cells.push(c); }
    this.hot = new Set([13, 47, 58, 82, 91]);
    // 阶段刻度
    const st = $('stage-ticks');
    this.ticks = CHAPTERS.map(() => { const i = document.createElement('i'); st.appendChild(i); return i; });
    // 章节条
    const chs = $('chapters');
    this.chEls = CHAPTERS.map(c => {
      const d = document.createElement('div'); d.className = 'ch';
      d.style.flex = String(c.t1 - c.t0);
      d.innerHTML = `<span><em>0${c.id}</em>${c.zh}</span><div class="pr"><i></i></div>`;
      d.onclick = (e) => { const r = d.getBoundingClientRect(); onSeek(c.t0 + (c.t1 - c.t0) * Math.max(0, (e.clientX - r.left) / r.width - 0.02)); };
      chs.appendChild(d); return d;
    });
    $('btn-play').onclick = onPlay;
    this.wave = $('wave').getContext('2d');
    this.radar = $('radar').getContext('2d');
    this.logEl = $('log');
    this.logN = -1;
    this.lastSub = null;
    this.cardChapter = null;
  }

  setPlaying(p) { $('btn-play').textContent = p ? '❚❚' : '▶'; }

  update(t, clock, extra = {}) {
    const ch = chapterAt(t);
    const T = (k) => keyed(TELE[k], t);
    // 顶栏
    const year = Math.floor(T('year'));
    const secs = 18 * 3600 + 120 + t * 1.0 + (year - 2078) * 37;
    const hh = Math.floor(secs / 3600) % 24, mm = Math.floor(secs / 60) % 60, ss = Math.floor(secs) % 60;
    $('ro-clock').textContent = `${year} · ${pad(hh)}:${pad(mm)}:${pad(ss)}`;
    $('ro-stage-n').textContent = `STAGE 0${ch.id} / 06`;
    $('ro-stage').textContent = ch.en;
    this.ticks.forEach((el, i) => el.className = i + 1 < ch.id ? 'done' : i + 1 === ch.id ? 'now' : '');
    const au = Math.pow(10, T('logAU'));
    const lightMin = au * 8.317;
    let link;
    if (lightMin < 60) link = `${fmt(lightMin, 1)} 分`;
    else if (lightMin < 60 * 48) link = `${fmt(lightMin / 60, 1)} 时`;
    else if (lightMin < 60 * 24 * 365) link = `${fmt(lightMin / 1440, 0)} 天`;
    else link = `${fmt(lightMin / 525960, 2)} 年`;
    $('ro-link').textContent = link;
    const bars = au < 5 ? 4 : au < 40 ? 3 : au < 2000 ? 2 : 1;
    [...$('ro-bars').children].forEach((s, i) => s.className = i < bars ? '' : 'off');

    // 推进面板
    const thrust = T('thrust') + Math.sin(clock * 3.1) * 0.25 * (t > 2 ? 1 : 0);
    $('v-thrust').textContent = fmt(Math.max(0, thrust), 1);
    $('v-newton').textContent = `${fmt(1.5 * Math.max(thrust, 0) / 100 + 0.0001, 2)} × 10¹⁶ N`;
    $('b-thrust').style.width = `${Math.min(100, thrust)}%`;
    const eng = Math.round(T('engines'));
    $('v-engines').textContent = `${eng.toLocaleString('en-US')} / 10,000`;
    const lit = Math.round(eng / 100);
    this.cells.forEach((c, i) => c.className = i < lit ? (this.hot.has(i) && t > 40 ? 'hot' : 'on') : '');
    const core = T('core');
    $('v-core').textContent = `${fmt(core, 2)} × 10⁸ K`;
    $('b-core').style.width = `${core / 10 * 100}%`;
    const steer = T('steer');
    $('v-steer').textContent = `${Math.round(steer)} %`; $('b-steer').style.width = `${steer}%`;
    const temp = T('temp');
    $('v-temp').textContent = `${Math.round(temp)} °C`; $('b-temp').style.width = `${(temp + 90) / 110 * 100}%`;
    const mag = T('mag');
    $('v-mag').textContent = `${fmt(mag, 1)} %`; $('b-mag').style.width = `${mag}%`;
    const res = T('res');
    $('v-res').textContent = `${fmt(res + Math.sin(clock * 1.7) * 0.03, 2)} Hz`;
    this._wave(clock, res, thrust);

    // 导航面板
    const vel = T('vel');
    if (t < 98) { $('v-vel').textContent = fmt(vel, 1); $('v-velu').textContent = '公里/秒'; $('v-frame').textContent = '日心系'; }
    else { const c = Math.min(0.5, vel); $('v-vel').textContent = fmt(c, 3); $('v-velu').textContent = '% c'; $('v-frame').textContent = `相对论 · γ ${fmt(1 / Math.sqrt(1 - Math.pow(c / 100, 2)), 4)}`; }
    if (ch.id === 6) { const dv = 0.5 - Math.max(0, (t - 157)) * 0.03; $('v-vel').textContent = fmt(Math.max(0.004, dv), 3); }
    $('t-dist').textContent = au < 2000 ? `${fmt(au, au < 10 ? 2 : 1)} AU` : `${fmt(au / 63241, 3)} 光年`;
    $('t-light').textContent = link;
    const ly = Math.max(0.0, 4.37 - au / 63241);
    $('t-acen').textContent = ch.id === 6 && t > 165 ? '0.0003 光年' : `${fmt(ly, 2)} 光年`;
    $('t-eta').textContent = t < 100 ? '公元 43,6xx' : 'ETA 公元 4578';
    if (t < 100) $('t-eta').textContent = `公元 ${fmt(43000 + 650 - t * 2.2, 0)}`;
    const reg = REGIONS.filter(r => r[0] <= t).pop();
    $('t-region').textContent = reg[1]; $('v-zone').textContent = reg[2];
    $('t-head').textContent = `l ${fmt(315.7 - t * 0.02, 1)}° b ${fmt(-0.7 + t * 0.003, 1)}°`;
    const range = extra.range || 8000;
    $('t-range').textContent = range < 1e6 ? `${fmt(range, 0)} km` : range < 1.5e8 * 2000 ? `${fmt(range / 1.496e8, 1)} AU` : `${fmt(range / 9.46e12, 1)} 光年`;
    const lr = Math.log10(Math.max(range, 1000));
    $('ruler-dot').style.left = `${Math.min(98, Math.max(0, (lr - 3) / (18 - 3) * 100))}%`;
    // 标签
    const tag = TAGS.filter(r => r[0] <= t).pop();
    const tp = $('tag-prop'), tn = $('tag-nav');
    tp.textContent = tag[1]; tp.classList.toggle('warn', !!tag[3]);
    tn.textContent = tag[2]; tn.classList.toggle('warn', !!tag[4]);
    this._radar(t, clock, au);

    // 事件日志
    const evs = EVENTS.filter(e => e[0] <= t);
    if (evs.length !== this.logN) {
      this.logN = evs.length;
      this.logEl.innerHTML = evs.slice(-4).reverse().map(e => `<li class="${e[3] ? 'warn' : ''}"><span>${e[1]}</span><b>${e[2]}</b></li>`).join('');
      $('log-n').textContent = `${evs.length} / ${EVENTS.length}`;
    }

    // 字幕
    const sub = SUBS.find(s => t >= s[0] && t < s[1]);
    const subs = $('subs');
    if (sub !== this.lastSub) {
      this.lastSub = sub;
      if (sub) { $('sub-zh').textContent = sub[2]; $('sub-en').textContent = sub[3]; }
    }
    subs.classList.toggle('off', !sub || !!extra.noSubs || t >= 170);

    // 章节标题卡
    const card = $('card');
    const end = t >= 170;
    const on = (ch.card && t >= ch.card[0] + 0.3 && t < ch.card[1]) || end;
    const key = end ? 'end' : ch.id;
    if (on && this.cardChapter !== key) {
      this.cardChapter = key;
      if (end) { $('card-k').textContent = 'FIN · 旅程结束'; $('card-t').textContent = 'BEYOND SOL'; $('card-z').textContent = '流浪之地之外'; $('card-s').textContent = '粉丝概念 · 非官方 · 向《流浪地球》致敬'; }
      else { $('card-k').textContent = `CHAPTER ${ch.id}`; $('card-t').textContent = ch.en; $('card-z').textContent = ch.zh; $('card-s').textContent = ch.years; }
    }
    card.classList.toggle('on', !!on);
    if (!on) this.cardChapter = on ? this.cardChapter : null;

    // 章节条
    CHAPTERS.forEach((c, i) => {
      const el = this.chEls[i];
      el.classList.toggle('now', c.id === ch.id);
      el.querySelector('i').style.width = `${Math.min(100, Math.max(0, (t - c.t0) / (c.t1 - c.t0) * 100))}%`;
    });
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    $('time').textContent = `${m}:${pad(s)} / ${Math.floor(DURATION / 60)}:${pad(DURATION % 60)}`;
  }

  _wave(clock, res, thrust) {
    const g = this.wave, W = g.canvas.width, H = g.canvas.height;
    g.clearRect(0, 0, W, H);
    g.strokeStyle = 'rgba(160,200,255,.85)'; g.lineWidth = 1.4; g.beginPath();
    const amp = 4 + Math.min(thrust, 100) / 100 * 16;
    for (let x = 0; x <= W; x += 2) {
      const u = x / W;
      const y = H / 2 + Math.sin(u * res * 3.2 + clock * 4) * amp * Math.sin(u * Math.PI) + Math.sin(u * 37 + clock * 9) * 1.5;
      x ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
    g.strokeStyle = 'rgba(140,170,220,.18)'; g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
  }

  _radar(t, clock, au) {
    const g = this.radar, W = g.canvas.width, H = g.canvas.height, cx = W / 2, cy = H / 2;
    g.clearRect(0, 0, W, H);
    g.strokeStyle = 'rgba(150,185,230,.22)'; g.lineWidth = 1;
    for (const r of [24, 50, 78]) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); }
    g.setLineDash([2, 4]); g.beginPath(); g.arc(cx, cy, 64, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    // 扫描扇区
    const a = clock * 0.9;
    const grd = g.createConicGradient ? g.createConicGradient(a, cx, cy) : null;
    if (grd) { grd.addColorStop(0, 'rgba(140,190,255,.32)'); grd.addColorStop(0.12, 'rgba(140,190,255,0)'); grd.addColorStop(1, 'rgba(140,190,255,0)'); g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, 78, 0, Math.PI * 2); g.fill(); }
    // 太阳
    g.fillStyle = '#ffc46a'; g.beginPath(); g.arc(cx, cy, 2.6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#9fb3cc'; g.font = '9px Orb, monospace'; g.fillText('SOL', cx + 6, cy - 4);
    // 对数距离映射到半径
    const r = Math.min(78, 8 + Math.log10(1 + au) * 14);
    const ang = 2.3;
    const ex = cx + Math.cos(ang) * r, ey = cy + Math.sin(ang) * r;
    g.strokeStyle = 'rgba(200,220,255,.6)'; g.setLineDash([1, 3]); g.beginPath(); g.moveTo(cx, cy); g.lineTo(ex, ey); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#e8f2ff'; g.beginPath(); g.arc(ex, ey, 2.4, 0, Math.PI * 2); g.fill();
    // 半人马座 α
    const ax = cx + Math.cos(ang) * 92, ay = cy + Math.sin(ang) * 92;
    g.strokeStyle = '#cfe0ff'; g.beginPath(); g.arc(Math.min(ax, W - 8), Math.min(ay, H - 8), 3, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#9fb3cc'; g.fillText('A-CEN', Math.min(ax, W - 8) + 6, Math.min(ay, H - 8) + 3);
  }
}
