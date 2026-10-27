// 生成式配乐：纯 Web Audio。低频持续音 + 逐章和弦铺底 + 引擎轰鸣 + 揭示时刻的低音冲击。
const CHORDS = {
  1: [38, 45, 50, 53, 57],   // D 小调
  2: [41, 48, 52, 57, 60],   // F 大七
  3: [45, 52, 57, 60, 64],   // A 小调
  4: [39, 46, 51, 55, 58, 62], // 降 E 利底亚色彩
  5: [43, 50, 55, 59, 62, 66], // G 大七加九
  6: [38, 45, 50, 54, 57, 62], // D 大调
};
const BOOMS = [1.4, 36.2, 52.4, 66.2, 96.2, 126.2, 145.2, 152.2, 155.2, 164.2];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Score {
  constructor() { this.ctx = null; this.on = true; this.ch = 0; this.lastT = -1; }
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = C.createGain(); this.master.gain.value = 0.0;
    const comp = C.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
    this.master.connect(comp).connect(C.destination);
    // 混响（合成冲激响应）
    const len = C.sampleRate * 4.5, ir = C.createBuffer(2, len, C.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.verb = C.createConvolver(); this.verb.buffer = ir;
    const vg = C.createGain(); vg.gain.value = 0.55; this.verb.connect(vg).connect(this.master);
    this.dry = C.createGain(); this.dry.gain.value = 0.5; this.dry.connect(this.master); this.dry.connect(this.verb);
    // 次低音
    this.sub = C.createOscillator(); this.sub.type = 'sine'; this.sub.frequency.value = mtof(26);
    const sg = C.createGain(); sg.gain.value = 0.22; this.sub.connect(sg).connect(this.dry); this.sub.start();
    // 引擎轰鸣：棕噪声 + 低通
    const nb = C.createBuffer(1, C.sampleRate * 3, C.sampleRate), nd = nb.getChannelData(0);
    let last = 0; for (let i = 0; i < nd.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; nd[i] = last * 3.2; }
    this.noise = C.createBufferSource(); this.noise.buffer = nb; this.noise.loop = true;
    this.rumbleF = C.createBiquadFilter(); this.rumbleF.type = 'lowpass'; this.rumbleF.frequency.value = 140;
    this.rumble = C.createGain(); this.rumble.gain.value = 0;
    this.noise.connect(this.rumbleF).connect(this.rumble).connect(this.dry); this.noise.start();
    // 和弦铺底
    this.padBus = C.createGain(); this.padBus.gain.value = 0.11;
    this.padF = C.createBiquadFilter(); this.padF.type = 'lowpass'; this.padF.frequency.value = 900; this.padF.Q.value = 0.6;
    this.padBus.connect(this.padF).connect(this.dry);
    this.voices = [];
    // 深空微光
    this.shimmer = C.createGain(); this.shimmer.gain.value = 0; this.shimmer.connect(this.verb);
    this.lfo = C.createOscillator(); this.lfo.frequency.value = 0.07; const lg = C.createGain(); lg.gain.value = 500; this.lfo.connect(lg).connect(this.padF.frequency); this.lfo.start();
    this.master.gain.setTargetAtTime(this.on ? 0.9 : 0, C.currentTime, 1.2);
  }
  toggle() { this.on = !this.on; if (this.ctx) this.master.gain.setTargetAtTime(this.on ? 0.9 : 0, this.ctx.currentTime, 0.3); return this.on; }
  _chord(id) {
    const C = this.ctx, now = C.currentTime;
    for (const v of this.voices) { v.g.gain.cancelScheduledValues(now); v.g.gain.setTargetAtTime(0, now, 1.4); v.o.forEach(o => o.stop(now + 8)); }
    this.voices = CHORDS[id].map((m, i) => {
      const g = C.createGain(); g.gain.value = 0; g.connect(this.padBus);
      const o = [-7, 0, 6].map(cents => { const os = C.createOscillator(); os.type = i < 2 ? 'triangle' : 'sawtooth'; os.frequency.value = mtof(m); os.detune.value = cents; os.connect(g); os.start(); return os; });
      g.gain.setTargetAtTime(i < 2 ? 0.5 : 0.22, now, 2.0);
      return { g, o };
    });
    // 高音微光
    const sh = C.createOscillator(); sh.type = 'sine'; sh.frequency.value = mtof(CHORDS[id][CHORDS[id].length - 1] + 24);
    const sg = C.createGain(); sg.gain.value = 0; sh.connect(sg).connect(this.shimmer); sh.start(); sh.stop(now + 30);
    sg.gain.setTargetAtTime(0.05, now + 2, 3); sg.gain.setTargetAtTime(0, now + 18, 4);
  }
  _boom(strength = 1) {
    const C = this.ctx, now = C.currentTime;
    const o = C.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(70, now); o.frequency.exponentialRampToValueAtTime(28, now + 2.5);
    const g = C.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.7 * strength, now + 0.05); g.gain.exponentialRampToValueAtTime(0.001, now + 4);
    o.connect(g).connect(this.dry); o.connect(g).connect(this.verb); o.start(now); o.stop(now + 4.2);
  }
  update(t, thrust, playing) {
    if (!this.ctx) return;
    const id = t < 36 ? 1 : t < 66 ? 2 : t < 96 ? 3 : t < 126 ? 4 : t < 152 ? 5 : 6;
    if (id !== this.ch) { this.ch = id; this._chord(id); }
    if (playing && this.lastT >= 0 && t > this.lastT && t - this.lastT < 0.5) for (const b of BOOMS) if (this.lastT < b && t >= b) this._boom(b === 1.4 || b === 155.2 ? 1.2 : 0.8);
    this.lastT = t;
    const now = this.ctx.currentTime;
    this.rumble.gain.setTargetAtTime(playing ? 0.05 + Math.min(thrust, 110) / 100 * (id === 1 || id === 6 ? 0.55 : 0.18) : 0.02, now, 0.4);
    this.rumbleF.frequency.setTargetAtTime(90 + thrust * 1.4, now, 0.5);
    this.shimmer.gain.setTargetAtTime(id >= 4 ? 1 : 0.5, now, 2);
  }
}
