/* 冰冰 · Live2D 版：模型会眨眼呼吸，情绪管她的嘴角和头 */
const stage = document.getElementById('stage');
const canvas = document.createElement('canvas');
canvas.style.cssText = 'width:100%;height:100%;display:block';
stage.insertBefore(canvas, stage.firstChild);

const app = new PIXI.Application({
  view: canvas,
  backgroundAlpha: 0,
  antialias: true,
  autoDensity: true,
  resolution: Math.min(2, devicePixelRatio),
});

let model = null;
let mood = null;

/* ---------- 面板 ---------- */
function set(id, v, lo = 0, hi = 100, text = null) {
  if (v === undefined || v === null || isNaN(v)) return;
  const w = Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100));
  const bar = document.getElementById('s-' + id);
  if (bar) {
    if (bar.dataset.orient === 'v') bar.style.setProperty('height', w + '%', 'important');
    else bar.style.setProperty('width', w + '%', 'important');
    const box = bar.parentElement;
    if (box) box.style.setProperty('--w', w + '%');
  }
  const lab = document.getElementById('v-' + id);
  if (lab) lab.textContent = text ?? Math.round(v);
}

/* ---------- 底色雷达：50 基线 + 星座加成 ---------- */
const BASE_AXES = [['warmth', '热情'], ['sensitivity', '敏感'], ['resilience', '韧性'],
                   ['optimism', '乐观'], ['openness', '开放'], ['stubbornness', '嘴硬']];

function drawBaseRadar(p, base) {
  const cv = document.getElementById('baseRadar');
  if (!cv) return;
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth || 340, h = cv.clientHeight || 214;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2 - 8, R = Math.min(w, h) * 0.28;
  const n = BASE_AXES.length;
  const ang = i => -Math.PI / 2 + i * Math.PI * 2 / n;
  const pt = (i, v) => {
    const r = R * Math.max(0, Math.min(100, v)) / 100;
    return [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r];
  };

  for (let g = 1; g <= 4; g++) {
    c.beginPath();
    for (let i = 0; i <= n; i++) { const [x, y] = pt(i % n, g * 25); i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.closePath();
    c.strokeStyle = g === 2 ? 'rgba(120,150,200,.45)' : 'rgba(150,175,215,.20)';
    c.lineWidth = 1;
    if (g === 2) c.setLineDash([4, 3]);
    c.stroke();
    c.setLineDash([]);
  }

  c.font = '9.5px system-ui, sans-serif';
  c.textAlign = 'left'; c.textBaseline = 'middle';
  c.fillStyle = 'rgba(130,150,190,.75)';
  c.fillText('100', cx + 3, cy - R);
  c.fillStyle = 'rgba(110,140,190,.9)';
  c.fillText('50', cx + 3, cy - R / 2);

  for (let i = 0; i < n; i++) {
    const [x, y] = pt(i, 100);
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(x, y);
    c.strokeStyle = 'rgba(150,175,215,.16)'; c.lineWidth = 1; c.stroke();
  }

  c.beginPath();
  for (let i = 0; i <= n; i++) { const [x, y] = pt(i % n, base); i ? c.lineTo(x, y) : c.moveTo(x, y); }
  c.closePath();
  c.fillStyle = 'rgba(120,170,240,.13)'; c.fill();
  c.setLineDash([3, 3]);
  c.strokeStyle = 'rgba(120,170,240,.55)'; c.lineWidth = 1.2; c.stroke();
  c.setLineDash([]);

  const vals = BASE_AXES.map(([k]) => (p[k] || 0) * 100);

  c.beginPath();
  vals.forEach((v, i) => { const [x, y] = pt(i, v); i ? c.lineTo(x, y) : c.moveTo(x, y); });
  c.closePath();
  const grd = c.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  grd.addColorStop(0, 'rgba(169,208,255,.42)');
  grd.addColorStop(1, 'rgba(246,182,212,.42)');
  c.fillStyle = grd; c.fill();
  c.strokeStyle = 'rgba(140,175,235,.9)'; c.lineWidth = 1.6; c.stroke();

  vals.forEach((v, i) => {
    const d = v - base;
    const [x0, y0] = pt(i, base), [x1, y1] = pt(i, v);
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1);
    c.strokeStyle = d > 0.5 ? '#f4a3c8' : (d < -0.5 ? '#8fa8d8' : 'rgba(120,150,200,.35)');
    c.lineWidth = 3.4; c.lineCap = 'round'; c.stroke();
    c.beginPath(); c.arc(x1, y1, 2.9, 0, 7);
    c.fillStyle = d > 0.5 ? '#ef7fb3' : (d < -0.5 ? '#6f8ccb' : '#9aa8c4'); c.fill();
  });

  c.textAlign = 'center'; c.textBaseline = 'middle';
  const hits = [];
  BASE_AXES.forEach(([k, label], i) => {
    const rr = R + 22;
    const x = cx + Math.cos(ang(i)) * rr, y = cy + Math.sin(ang(i)) * rr;
    const d = Math.round(vals[i] - base);
    c.font = '11.5px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
    c.fillStyle = '#6f7c9c';
    c.fillText(label, x, y - 7);
    c.font = '600 12px system-ui, sans-serif';
    c.fillStyle = '#4f5c80';
    c.fillText(String(Math.round(vals[i])), x - 8, y + 8);
    if (d !== 0) {
      c.font = '600 10px system-ui, sans-serif';
      c.fillStyle = d > 0 ? '#d3719f' : '#5f7bb8';
      c.fillText((d > 0 ? '+' : '') + d, x + 13, y + 8);
    }
    const desc = {
      warmth: '起反应有多快', sensitivity: '被牵动有多深', resilience: '回落有多快',
      optimism: '往好处想的倾向', openness: '愿意试新东西', stubbornness: '嘴比心硬多少'
    }[k] || '';
    hits.push({ x, y, r: 30, text: label + ' ' + Math.round(vals[i]) +
      (d > 0 ? '（星座 +' + d + '）' : d < 0 ? '（星座 ' + d + '）' : '（星座没动）') +
      (desc ? ' · ' + desc : '') });
  });
  cv._hits = hits;

  const sum = document.getElementById('baseSummary');
  if (sum) {
    const up = vals.filter(v => v > base + 0.5).length;
    const dn = vals.filter(v => v < base - 0.5).length;
    sum.textContent = '从 ' + base + ' 起步：' + up + ' 项被星座加上、' + dn + ' 项被扣掉';
  }
}

/* ---------- 天赋雷达 ---------- */
const radar = document.getElementById('radar');
const rc = radar.getContext('2d');
const TALENTS = ['理性', '直觉', '共情', '表达', '动手', '胆量'];
const TDESC = { 理性: '讲道理、拆问题', 直觉: '一眼看穿', 共情: '接住别人的情绪',
                表达: '说清和写清', 动手: '手上出活', 胆量: '敢不敢先迈一步' };

function hueRGB(hue) {
  const h = hue * 6, i = Math.floor(h) % 6, f = h - Math.floor(h);
  const q = 1 - f, t = f;
  const table = [[1, t, 0], [q, 1, 0], [0, 1, t], [0, q, 1], [t, 0, 1], [1, 0, q]][i];
  return { r: table[0] * .55 + .45, g: table[1] * .55 + .45, b: table[2] * .55 + .45 };
}

function drawRadar(t, acc) {
  const dpr = Math.min(2, devicePixelRatio);
  const w = radar.clientWidth || 300, h = radar.clientHeight || 150;
  if (radar.width !== Math.round(w * dpr) || radar.height !== Math.round(h * dpr)) {
    radar.width = Math.round(w * dpr);
    radar.height = Math.round(h * dpr);
  }
  rc.setTransform(dpr, 0, 0, dpr, 0, 0);
  rc.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2 - 6, R = Math.min(w, h) * 0.27;
  const n = TALENTS.length;
  const ang = i => -Math.PI / 2 + i * Math.PI * 2 / n;
  const rgb = `${acc.r * 255 | 0},${acc.g * 255 | 0},${acc.b * 255 | 0}`;

  for (let ring = 1; ring <= 4; ring++) {
    const r = R * ring / 4;
    rc.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = ang(i % n);
      const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      i ? rc.lineTo(px, py) : rc.moveTo(px, py);
    }
    rc.strokeStyle = ring === 4 ? 'rgba(130,160,200,.42)' : 'rgba(150,175,210,.20)';
    rc.lineWidth = 1;
    rc.stroke();
  }
  for (let i = 0; i < n; i++) {
    const a = ang(i);
    rc.beginPath();
    rc.moveTo(cx, cy);
    rc.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    rc.strokeStyle = 'rgba(150,175,210,.16)';
    rc.stroke();
  }
  const pts = TALENTS.map((k, i) => {
    const v = Math.max(0, Math.min(100, t[k] ?? 0)) / 100;
    const a = ang(i);
    return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v];
  });
  rc.beginPath();
  pts.forEach(([x, y], i) => i ? rc.lineTo(x, y) : rc.moveTo(x, y));
  rc.closePath();
  const grad = rc.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  grad.addColorStop(0, 'rgba(150,200,240,.55)');
  grad.addColorStop(1, `rgba(${rgb},.42)`);
  rc.fillStyle = grad;
  rc.fill();
  rc.strokeStyle = `rgba(${rgb},.85)`;
  rc.lineWidth = 1.6;
  rc.stroke();

  rc.textAlign = 'center';
  rc.textBaseline = 'middle';
  const thits = [];
  TALENTS.forEach((k, i) => {
    const a = ang(i);
    const [x, y] = pts[i];
    rc.beginPath();
    rc.arc(x, y, 2.6, 0, 6.283);
    rc.fillStyle = `rgba(${rgb},.95)`;
    rc.fill();
    const lx = cx + Math.cos(a) * (R + 18), ly = cy + Math.sin(a) * (R + 14);
    rc.font = '11px "Microsoft YaHei UI", sans-serif';
    rc.fillStyle = '#6a7a96';
    rc.fillText(k, lx, ly);
    rc.font = '10px "Microsoft YaHei UI", sans-serif';
    rc.fillStyle = '#98a7c0';
    rc.fillText(Math.round(t[k] ?? 0), lx, ly + 13);
    thits.push({ x: lx, y: ly, r: 26,
      text: k + ' ' + Math.round(t[k] ?? 0) + ' · ' + (TDESC[k] || '') });
  });
  radar._hits = thits;
}

/* ---------- 情绪 → 面板 + 模型 ---------- */
let zodiacTipText = '';
function renderZodiacTip(s) {
  const z = s.zodiac || {};
  const t = (s.zodiac_table && z.name) ? s.zodiac_table[z.name] : null;
  const traits = z.traits || {};
  const mood = s.zodiac_mood || null;
  const out = [];
  out.push('星座：' + (z.name || '—') + (z.birth ? '（' + z.birth + '）' : ''));
  if (t) {
    const seg = Object.keys(t).map(k => k + (t[k] >= 0 ? '+' : '') + Math.round(t[k] * 100));
    if (seg.length) out.push('基础加成：' + seg.join('  '));
  }
  const seg2 = Object.keys(traits).map(k => k + '+' + Math.round(traits[k] * 100));
  if (seg2.length) out.push('特质：' + seg2.join('  '));
  if (mood && mood.note) out.push('小脾气：' + mood.note + ' ' + (mood.bias >= 0 ? '+' : '') + mood.bias);
  zodiacTipText = out.join('<br>');
}

function applyState(s) {
  mood = s.emotion;
  const v = s.emotion.valence, a = s.emotion.arousal, c = s.emotion.control;
  const hue = v >= 0 ? 0.56 + (0.94 - 0.56) * (v / 100) : 0.56 + (0.60 - 0.56) * (-v / 100);
  const col = hueRGB(hue);

  document.getElementById('moodLabel').textContent = s.emotion.label;
  document.getElementById('moodSub').textContent =
    `愉悦 ${v.toFixed(0)} · 唤醒 ${a.toFixed(0)} · 掌控 ${c.toFixed(0)}`;
  const inL = document.getElementById('innerLabel'), outL = document.getElementById('outerLabel');
  const inten = document.getElementById('moodIntensity');
  if (inten && s.emotion.intensity !== undefined) inten.textContent = Math.round(s.emotion.intensity * 100) + '%';
  if (inL) inL.textContent = s.emotion.inner || s.emotion.label;
  if (outL) outL.textContent = s.emotion.outer || s.emotion.label;

  set('val', v, 0, 100, Math.round(v));
  set('aro', a);
  set('ctl', c);
  for (const [id, key] of [['adr', 'adrenaline'], ['cor', 'cortisol'], ['dop', 'dopamine'],
                           ['oxy', 'oxytocin'], ['ser', 'serotonin'],
                           ['end', 'endorphin'], ['mel', 'melatonin']])
    set(id, s.hormones[key]);

  const p = s.personality;
  set('warm', p.warmth * 100); set('sens', p.sensitivity * 100); set('open', p.openness * 100);
  set('resi', p.resilience * 100); set('opti', p.optimism * 100);
  if (p.stubbornness !== undefined) set('stub', p.stubbornness * 100);

  // 身体
  const b = s.body || {};
  if (b.sleepiness !== undefined) set('sleep', b.sleepiness);
  if (b.hunger !== undefined) set('hunger', b.hunger);
  if (b.stamina !== undefined) set('stam', b.stamina);
  if (b.health !== undefined) set('health', b.health);

  // 关系
  const r = s.relation || {};
  const R = [['aff', 'affection'], ['tru', 'trust'], ['dep', 'dependence'],
             ['sec', 'security'], ['rap', 'rapport']];
  for (const [id, key] of R) {
    const v2 = r[key];
    if (v2 === undefined) continue;
    const bar = document.getElementById('r-' + id), num = document.getElementById('rv-' + id);
    if (bar) { const w2 = Math.max(0, Math.min(100, v2)); bar.style.width = w2 + '%'; if (bar.parentElement) bar.parentElement.style.setProperty('--w', w2 + '%'); }
    if (num) num.textContent = Math.round(v2);
  }

  // 星座
  if (s.zodiac) {
    const zn = document.getElementById('zodiacName'); if (zn) zn.textContent = s.zodiac.name || '';
    const zb = document.getElementById('zodiacBirth'); if (zb) { const _p = s.profile || {}; zb.textContent = (_p.birth_year && _p.birth_month && _p.birth_day) ? (_p.birth_year + ' 年 ' + _p.birth_month + ' 月 ' + _p.birth_day + ' 日') : (s.zodiac.birth || ''); }
    const zt = document.getElementById('zodiacTraits');
    if (zt && s.zodiac.traits) {
      zt.innerHTML = Object.entries(s.zodiac.traits)
        .map(([k, val]) => '<span>' + k + ' +' + Math.round(val * 100) + '</span>').join('');
    }
  }

  // 日子
  if (s.days) {
    const a1 = document.getElementById('d-age'); if (a1) a1.textContent = s.days.age ?? '—';
    const h1 = document.getElementById('d-height'); if (h1) h1.textContent = s.days.height_cm ?? '—';
    const t1 = document.getElementById('d-together');
    if (t1) t1.textContent = (s.days.together === null || s.days.together === undefined) ? '—' : s.days.together;
  }

  // 谁在推我
  if (s.influences) {
    const box = document.getElementById('infl');
    if (box) box.innerHTML = s.influences.map(x => '<li>' + x + '</li>').join('');
  }

  const o = s.outbound;
  set('delay', (o.delay - .5) / 1.7 * 100, 0, 100, o.delay + '×');
  set('verb', o.verbosity / 1.6 * 100, 0, 100, o.verbosity + '×');
  set('urge', o.urge / 1.6 * 100, 0, 100, o.urge + '×');
  set('cling', o.cling / 1.3 * 100, 0, 100, o.cling + '×');

  if (s.talents) { drawRadar(s.talents, col); }

  // 天赋六格
  const grid = document.getElementById('talentGrid');
  if (grid && s.talents) {
    grid.innerHTML = TALENTS.map(k => '<div class="cell">' + k +
      '<i>' + Math.round(s.talents[k] || 0) + '</i></div>').join('');
  }

  if (s.clock) setClock(s.clock);
  if (s.zodiac) renderZodiacTip(s);
  if (s.profile) renderGear(s);
  // 角色名：空着就显示「未命名」
  try {
    const roleName = (s.profile && s.profile.name) || '未命名';
    const nb = document.querySelector('.name b');
    if (nb) nb.textContent = '角色：' + roleName;
  } catch (e) {}
  if (window.fillProfileForm) window.fillProfileForm(s);
  if (s.personality) drawBaseRadar(s.personality, s.base_points || 50);
  if (s.memories) drawStarMap(s.memories);
  if (s.proactive) renderProactive(s.proactive);
  if (s.zodiac_mood) {
    const zEl = document.getElementById('zodiacApply');
    const zm = s.zodiac_mood;
    const zt = s.zodiac_table && s.zodiac_table[s.zodiac && s.zodiac.name];
    if (zEl) zEl.textContent = '50 起步' + (zt ? '：' + Object.entries(zt).map(([k, v]) => k + (v > 0 ? '+' : '') + Math.round(v * 100)).join(' ') : '') + '；再送你一条：' + zm.note + ' +' + zm.bias;
  }
  if (s.zodiac_table) renderZodiac(s.zodiac_table, s.zodiac && s.zodiac.name);
}

/* ---------- 拉数据 ---------- */
async function poll() {
  try {
    const r = await fetch('/state', { cache: 'no-store' });
    if (r.ok) applyState(await r.json());
  } catch (e) { }
  setTimeout(poll, 4000);
}

document.querySelectorAll('.btns button').forEach(b => {
  b.addEventListener('click', async () => {
    const r = await fetch('/event', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: b.dataset.kind, intensity: 1 })
    });
    if (r.ok) applyState(await r.json());
  });
});

/* ---------- Live2D ---------- */
function layout() {
  const w = stage.clientWidth, h = stage.clientHeight;
  app.renderer.resize(w, h);
  if (!model) return;
  // 按模型真实可见范围贴合，别信画布大小（有的模型画布留白特别多）
  model.scale.set(1);
  model.position.set(0, 0);
  const b = model.getBounds();
  if (!b.width || !b.height) return;
  const s = Math.min((h * 0.96) / b.height, (w * 0.98) / b.width) * (window.__MODEL_ZOOM || 1);
  model.scale.set(s);
  model.x = w / 2 - (b.x + b.width / 2) * s;
  model.y = h * 0.5 - (b.y + b.height / 2) * s - h * 0.04;
}

function showNoModel(msg) {
  const wrap = document.getElementById('stageWrap');
  if (!wrap || document.getElementById('noModel')) return;
  const d = document.createElement('div');
  d.id = 'noModel';
  d.innerHTML = msg || '还没放模型。<br>把自己的 Live2D 模型放进 model 目录，<br>再把路径写进 model/model.json 的 path。';
  d.style.cssText = 'position:absolute;left:16px;right:16px;top:110px;font-size:12.5px;line-height:2;' +
    'color:var(--text2);text-align:center;pointer-events:none;';
  wrap.appendChild(d);
}

async function initLive2D() {
  let cfg = null;
  try {
    const r = await fetch('model/model.json', { cache: 'no-store' });
    if (r.ok) cfg = await r.json();
  } catch (e) { cfg = null; }
  const path = cfg && cfg.path;
  if (!path) { showNoModel(); return; }
  model = await PIXI.live2d.Live2DModel.from(path, {
    autoInteract: true,
  });
  app.stage.addChild(model);
  layout();

  // 情绪：管嘴角、眉头、头歪不歪
  model.internalModel.on('beforeModelUpdate', () => {
    const e = mood;
    if (!e) return;
    const core = model.internalModel.coreModel;
    const v = Math.max(-1, Math.min(1, e.valence / 100));
    const a = e.arousal / 100;
    core.setParameterValueById('ParamMouthForm', v * 0.9);
    core.setParameterValueById('ParamAngleZ', v * 5);
    core.setParameterValueById('ParamBrowLY', v * 0.5);
    core.setParameterValueById('ParamBrowRY', v * 0.5);
    core.setParameterValueById('ParamEyeSmile', Math.max(0, v) * 0.7);
    core.setParameterValueById('ParamCheek', Math.max(0, -v) * 0.4);
    core.setParameterValueById('ParamBreath', 0.4 + a * 0.5);
  });
}

addEventListener('resize', layout);
initLive2D().catch(err => {
  document.getElementById('moodSub').textContent = '模型没加载上：' + err.message;
  showNoModel();
});
poll();
requestAnimationFrame(function () { requestAnimationFrame(starLoop); });

/* ---------- 时钟 ---------- */
let lastClock = null;
function setClock(c) {
  lastClock = c;
  const t = document.getElementById('clockTime');
  const d = document.getElementById('clockDate');
  const p = document.getElementById('clockPhase');
  if (t) t.textContent = c.time;
  if (d) d.textContent = c.date + ' · ' + c.weekday;
  if (p) p.textContent = c.phase;
}
setInterval(() => {
  if (!lastClock) return;
  const now = new Date();
  const t = document.getElementById('clockTime');
  if (t) t.textContent = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map(n => String(n).padStart(2, '0')).join(':');
}, 1000);

/* ---------- 记忆星图 ---------- */
const starCanvas = document.getElementById('starMap');
const sc = starCanvas.getContext('2d');
const GROUP_COLOR = {
  '用户': '#7fb4ff', '反馈': '#ffb3d1', '经历': '#9d8bff',
  '约定': '#ffd28a', '参考': '#7fdcc4', '我自己': '#ffa8a8', '其他': '#b9c4dc'
};
let lastMems = [];
let starNodes = [];
let starPick = null;

function paintStars(ctx, W, H, mems, pick, big, t) {
  t = t || 0;
  ctx.clearRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, Math.max(W, H) * 0.72);
  g.addColorStop(0, '#1d2846'); g.addColorStop(1, '#0e1428');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const groups = [...new Set(mems.map(m => m.group))];
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) * (big ? 0.30 : 0.30);
  const hubs = {};
  groups.forEach((g, i) => {
    const a = -Math.PI / 2 + i / groups.length * Math.PI * 2 + t * 0.035;
    hubs[g] = { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, a, n: 0 };
  });

  ctx.strokeStyle = 'rgba(150,180,235,.22)';
  ctx.lineWidth = 1;
  groups.forEach(g => {
    const h = hubs[g];
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(h.x, h.y); ctx.stroke();
    const orb = Math.min(W, H) * (big ? 0.10 : 0.085);
    ctx.beginPath(); ctx.arc(h.x, h.y, orb, 0, 6.283);
    ctx.strokeStyle = 'rgba(150,180,235,.16)'; ctx.stroke();
  });

  const nodes = [];
  mems.forEach(m => {
    const h = hubs[m.group] || hubs[groups[0]];
    h.n += 1;
    const idx = h.n;
    const spread = (big ? 26 : 8) + idx * (big ? 15 : 6.2);
    const seed = Math.sin(idx * 12.9898 + h.a * 7.1) * 1.9;
    const speed = (0.10 + 0.06 * (((idx * 53) % 100) / 100)) * (idx % 2 ? 1 : -1);
    const a = h.a + Math.PI / 2 + seed + t * speed;
    const rr = spread * (0.55 + ((idx * 37) % 100) / 100 * 0.6) * (1 + Math.sin(t * 0.7 + idx) * 0.05);
    const x = h.x + Math.cos(a) * rr * 0.9;
    const y = h.y + Math.sin(a) * rr * 0.9;
    const r = (big ? 2.6 : 1.5) + Math.min(big ? 5 : 3, (m.desc || '').length / (big ? 14 : 22));
    const col = GROUP_COLOR[m.group] || '#b9c4dc';
    const on = m === pick;
    ctx.beginPath(); ctx.arc(x, y, on ? r + 1.5 : r, 0, 6.283);
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 2.1 + idx * 1.7);
    ctx.shadowColor = col; ctx.shadowBlur = on ? 14 : 8; ctx.fillStyle = col; ctx.fill(); ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(x, y, r + (big ? 4 : 2.6), 0, 6.283);
    ctx.strokeStyle = col + (on ? 'cc' : '55'); ctx.lineWidth = 1; ctx.stroke();
    nodes.push({ x, y, r: r + (big ? 8 : 3), m, col });
  });

  ctx.font = (big ? 14 : 10) + 'px "Microsoft YaHei UI", sans-serif';
  ctx.textAlign = 'center';
  groups.forEach(g => {
    const h = hubs[g];
    ctx.fillStyle = GROUP_COLOR[g] || '#b9c4dc';
    ctx.fillText(g, h.x, h.y - (big ? 16 : 9));
  });
  ctx.textAlign = 'left';
  return nodes;
}

function fitCanvas(cv, cssW, cssH) {
  const dpr = Math.min(2, devicePixelRatio);
  if (cv.width !== Math.round(cssW * dpr)) {
    cv.width = Math.round(cssW * dpr);
    cv.height = Math.round(cssH * dpr);
  }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

const T0 = performance.now();
function starTime() { return (performance.now() - T0) / 1000; }

function drawStarMap(mems) {
  lastMems = mems;
  const W = starCanvas.clientWidth, H = starCanvas.clientHeight;
  if (!W || !H) return;
  starNodes = paintStars(fitCanvas(starCanvas, W, H), W, H, mems, starPick, false, starTime());
  const hint = document.getElementById('starHint');
  if (hint && !starPick) hint.textContent = mems.length + ' 颗星 · 点开看大图';
}

/* 行星环绕：一直转 */
let starRAF = 0, starLastPaint = 0;
function starLoop() {
  starRAF = requestAnimationFrame(starLoop);
  const now = performance.now();
  if (now - starLastPaint < 33) return;      // ~30fps
  starLastPaint = now;
  const W = starCanvas.clientWidth, H = starCanvas.clientHeight;
  if (!W || !H || !lastMems.length) return;
  const t = starTime();
  starNodes = paintStars(fitCanvas(starCanvas, W, H), W, H, lastMems, starPick, false, t);
  if (starOverlay.classList.contains('on') && starBig.clientWidth) {
    const bw = starBig.clientWidth, bh = starBig.clientHeight;
    bigNodes = paintStars(fitCanvas(starBig, bw, bh), bw, bh, lastMems, null, true, t);
  }
  if (starPick) {
    const hint = document.getElementById('starHint');
    if (hint) hint.textContent = starPick.title;
  }
}

/* 点击放大 */
let bigNodes = [];
const starOverlay = document.createElement('div');
starOverlay.id = 'starOverlay';
starOverlay.innerHTML = '<div class="bigcard"><canvas id="starMapBig"></canvas>' +
  '<div class="bighint">点空白或按 Esc 关掉 · 主星是我，中星是记忆，外圈以后待办也用这里</div></div>';
document.body.appendChild(starOverlay);
const bigClose = document.createElement('button');
bigClose.className = 'bigclose'; bigClose.textContent = '×';
bigClose.title = '关闭';
starOverlay.querySelector('.bigcard').appendChild(bigClose);
bigClose.addEventListener('click', () => starOverlay.classList.remove('on'));
const starBig = starOverlay.querySelector('#starMapBig');

function openStars() {
  const W = Math.min(innerWidth - 160, 980);
  const H = Math.min(innerHeight - 160, 720);
  const card = starOverlay.querySelector('.bigcard');
  card.style.width = W + 'px';
  card.style.height = (H + 34) + 'px';
  starBig.style.width = W + 'px';
  starBig.style.height = H + 'px';
  const ctx = fitCanvas(starBig, W, H);
  bigNodes = paintStars(ctx, W, H, lastMems, null, true, starTime());
  starOverlay.classList.add('on');
}

starOverlay.addEventListener('click', ev => {
  if (ev.target === starOverlay || ev.target.classList.contains('bighint')) {
    starOverlay.classList.remove('on'); return;
  }
  if (ev.target.id === 'starMapBig') {
    const r = starBig.getBoundingClientRect();
    const x = ev.clientX - r.left, y = ev.clientY - r.top;
    const hit = bigNodes.find(n => (n.x - x) ** 2 + (n.y - y) ** 2 < 400);
    if (!hit) { starOverlay.classList.remove('on'); return; }
    const ctx = fitCanvas(starBig, r.width, r.height);
    bigNodes = paintStars(ctx, r.width, r.height, lastMems, hit.m, true);
    starOverlay.querySelector('.bighint').textContent =
      hit.m.title + ' · ' + hit.m.group + (hit.m.desc ? ' · ' + hit.m.desc : '');
  }
});
addEventListener('keydown', ev => { if (ev.key === 'Escape') starOverlay.classList.remove('on'); });

if (starCanvas) {
  starCanvas.style.cursor = 'zoom-in';
  starCanvas.addEventListener('click', openStars);
}

/* ---------- 星座加减表 ---------- */
function renderZodiac(table, mine) {
  const box = document.getElementById('zodiacTable');
  if (!box) return;
  box.innerHTML = Object.entries(table).map(([name, mods]) => {
    const txt = Object.entries(mods).map(([k, v]) =>
      k + (v > 0 ? '+' : '') + Math.round(v * 100)).join(' ');
    return '<div class="zrow' + (name === mine ? ' me' : '') + '"><span>' + name +
      '</span><span>' + txt + '</span></div>';
  }).join('');
}


function renderProactive(p) {
  const l = document.getElementById('p-left');
  const c = document.getElementById('p-cap');
  const g = document.getElementById('p-gap');
  const w = document.getElementById('p-why');
  if (l) l.textContent = p.left;
  if (c) c.textContent = p.cap;
  if (g) g.textContent = p.gap_min;
  if (w) w.textContent = (p.blocked ? '现在是夜里，我不主动找你，等你先说。' : (p.why || '')) +
    '（已发 ' + p.used + ' 条）';
}






/* 说明卡：折叠时只占自身高度，展开时填满剩余空间 */
(function () {
  const ex = document.getElementById('explain');
  const card = document.getElementById('explainCard');
  if (!ex || !card) return;
  const sync = () => { card.style.flex = ex.open ? '1 1 auto' : '0 0 auto'; };
  ex.addEventListener('toggle', sync);
  sync();
})();


/* ---------- 帮助浮层 ---------- */
(function () {
  const btn = document.getElementById('helpBtn');
  const pop = document.getElementById('helpPop');
  if (!btn || !pop) return;
  let hoverTimer = null;
  btn.addEventListener('mouseenter', () => { hoverTimer = setTimeout(() => pop.classList.add('on'), 260); });
  btn.addEventListener('mouseleave', () => { clearTimeout(hoverTimer); });
  pop.addEventListener('mouseenter', () => clearTimeout(hoverTimer));
  pop.addEventListener('mouseleave', () => pop.classList.remove('on'));
  document.addEventListener('click', e => {
    if (!pop.contains(e.target) && e.target !== btn) pop.classList.remove('on');
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') pop.classList.remove('on'); });
})();

/* ---------- 雷达 hover 提示 ---------- */
(function () {
  const tip = document.getElementById('tip');
  if (!tip) return;
  [['baseRadar'], ['radar']].forEach(([id]) => {
    const cv = document.getElementById(id);
    if (!cv) return;
    cv.style.cursor = 'crosshair';
    cv.addEventListener('mousemove', ev => {
      const hits = cv._hits || [];
      const r = cv.getBoundingClientRect();
      const x = ev.clientX - r.left, y = ev.clientY - r.top;
      let best = null, bd = 1e9;
      hits.forEach(h => {
        const d = Math.hypot(h.x - x, h.y - y);
        if (d < h.r && d < bd) { bd = d; best = h; }
      });
      if (best) {
        tip.textContent = best.text;
        tip.style.display = 'block';
        tip.style.left = Math.max(8, Math.min(ev.clientX + 14, innerWidth - tip.offsetWidth - 12)) + 'px';
        tip.style.top = Math.max(8, Math.min(ev.clientY + 16, innerHeight - tip.offsetHeight - 12)) + 'px';
      } else {
        tip.style.display = 'none';
      }
    });
    cv.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
  });
})();

(function () {
  const tip = document.getElementById('tip');
  if (!tip) return;
  const show = (el) => {
    tip.textContent = el.dataset.tip || '';
    tip.style.display = 'block';
  };
  const hide = () => { tip.style.display = 'none'; };
  document.querySelectorAll('.hint').forEach((b) => {
    b.addEventListener('mouseenter', () => show(b));
    b.addEventListener('mouseleave', hide);
    b.addEventListener('click', (e) => { e.stopPropagation(); show(b); });
  });
  document.addEventListener('mousemove', (e) => {
    const b = e.target && e.target.closest ? e.target.closest('.hint') : null;
    if (!b) return;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(e.clientX + 14, window.innerWidth - tw - 12)) + 'px';
    tip.style.top = Math.max(8, Math.min(e.clientY + 16, window.innerHeight - th - 12)) + 'px';
  });
  document.addEventListener('click', (e) => {
    if (!(e.target && e.target.closest && e.target.closest('.hint'))) hide();
  });
})();

/* ---------- 齿轮设置 ---------- */
(function () {
  const btn = document.getElementById('gearBtn');
  const pop = document.getElementById('gearPop');
  if (!btn || !pop) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    pop.classList.toggle('on');
  });
  document.addEventListener('click', (e) => {
    if (!pop.contains(e.target) && e.target !== btn) pop.classList.remove('on');
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') pop.classList.remove('on'); });
})();

function renderGear(s) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const p = s.profile || {};
  set('g-name', p.name || '—');
  set('g-birth', (p.birth_year || '') + ' 年 ' + (p.birth_month || '') + ' 月 ' + (p.birth_day || '') + ' 日');
  set('g-zodiac', p.zodiac || '—');
  set('g-height', (p.height_cm || '—') + ' cm');
  const pr = s.proactive || {};
  if (pr.cap != null) set('g-cap', pr.cap + ' 条');
  if (pr.gap_min != null) set('g-gap', pr.gap_min + ' 分钟');
  set('g-night', (s.night_mode === false ? '不静音' : '23:00 - 07:00'));
}




(function () {
  const cell = document.getElementById('factZodiac');
  const tip = document.getElementById('tip');
  if (!cell || !tip) return;
  cell.addEventListener('mouseenter', function () {
    if (!zodiacTipText) return;
    tip.innerHTML = zodiacTipText;
    tip.style.display = 'block';
  });
  cell.addEventListener('mousemove', function (ev) {
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = ev.clientX + 14, y = ev.clientY + 16;
    if (x + w > innerWidth - 10) x = ev.clientX - w - 14;
    if (y + h > innerHeight - 10) y = innerHeight - h - 12;
    tip.style.left = Math.max(8, x) + 'px';
    tip.style.top = Math.max(8, y) + 'px';
  });
  cell.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
})();


(function () {
  const BB_THEMES = {
    '冰蓝': { accent: '#7fa8e8', accent2: '#a9d0ff', bg: ['#ffeaf3', '#e6f1ff', '#eef6ff', '#f7f9ff', '#eef4ff', '#f8f2f8'] },
    '樱粉': { accent: '#ef9ec4', accent2: '#ffcfe1', bg: ['#ffeef6', '#fff2f7', '#f7f2ff', '#fdf7fb', '#f7f1fa', '#fbf4fa'] },
    '薄荷': { accent: '#7cc7b2', accent2: '#bce7dc', bg: ['#eafaf4', '#eef7fb', '#f2fbf7', '#f6fcfb', '#eef8f5', '#f2faf8'] },
    '暮紫': { accent: '#9d9be8', accent2: '#c8c4f4', bg: ['#f2effd', '#f5f1ff', '#f6f3fd', '#f8f6fe', '#f1eefb', '#f7f4fd'] },
    '暖砂': { accent: '#e0a97a', accent2: '#f6d3b4', bg: ['#fdf3e8', '#fbf5ee', '#f9f4ee', '#fdf9f3', '#f9f3ea', '#fbf6ef'] }
  };

  function mixBlack(hex, r) {
  const c = hex2rgb(hex), k = 1 - (r || 0);
  return 'rgb(' + Math.round(c[0] * k + 40 * r) + ',' + Math.round(c[1] * k + 52 * r) + ',' + Math.round(c[2] * k + 78 * r) + ')';
}
function hex2rgb(hex) {
    let s = hex.replace('#', '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    const n = parseInt(s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mixWhite(hex, r) {
    const [a, b, c] = hex2rgb(hex);
    const f = (v) => Math.round(v + (255 - v) * r).toString(16).padStart(2, '0');
    return '#' + f(a) + f(b) + f(c);
  }
  function paint(t) {
    const root = document.documentElement.style;
    root.setProperty('--accent', t.accent);
    root.setProperty('--accent2', t.accent2 || mixWhite(t.accent, 0.5));
    root.setProperty('--bar2', t.accent);
    root.setProperty('--bar1', mixWhite(t.accent, 0.38));
    root.setProperty('--title', mixBlack(t.accent, 0.74));
    root.setProperty('--text', mixBlack(t.accent, 0.56));
    root.setProperty('--text2', mixBlack(t.accent, 0.34));
    const bg = t.bg || [mixWhite(t.accent, 0.88), mixWhite(t.accent, 0.9), mixWhite(t.accent, 0.94),
                        mixWhite(t.accent, 0.96), mixWhite(t.accent, 0.92), mixWhite(t.accent, 0.95)];
    ['--bg-a', '--bg-b', '--bg-c', '--bg-d1', '--bg-d2', '--bg-d3'].forEach((k, i) => root.setProperty(k, bg[i]));
  }
  function save(t) { try { localStorage.setItem('bb-theme', JSON.stringify(t)); } catch (e) {} }
  function load() {
    try {
      const raw = localStorage.getItem('bb-theme');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  const saved = load();
  if (saved) paint(saved);

  document.addEventListener('click', function (ev) {
    const b = ev.target.closest('[data-theme]');
    if (b) {
      const t = BB_THEMES[b.dataset.theme];
      if (t) { paint(t); save(t); }
      return;
    }
    if (ev.target.id === 'themeApply') {
      const inp = document.getElementById('themeCustom');
      const v = (inp.value || '').trim();
      if (!/^#?[0-9a-fA-F]{6}$/.test(v)) { inp.value = ''; return; }
      const hex = v[0] === '#' ? v : '#' + v;
      const t = { accent: hex };
      paint(t); save(t);
      inp.value = '';
    }
  });
})();

/* ---------- 页面缩放 ---------- */
(function () {
  const KEY = 'bb-zoom';
  const rng = document.getElementById('zoomRange');
  const lab = document.getElementById('g-zoom');
  if (!rng) return;
  function apply(pct) {
    pct = Math.max(70, Math.min(150, Math.round(pct)));
    document.documentElement.style.setProperty('--zoom', pct / 100);
    if (lab) lab.textContent = pct + '%';
    rng.value = pct;
    try { localStorage.setItem(KEY, pct); } catch (e) {}
  }
  let saved = 100;
  try { saved = Number(localStorage.getItem(KEY)) || 100; } catch (e) {}
  apply(saved);
  rng.addEventListener('input', () => apply(rng.value));
  document.addEventListener('click', (e) => {
    const b = e.target && e.target.closest && e.target.closest('[data-zoom]');
    if (!b) return;
    apply(Number(rng.value) + Number(b.dataset.zoom));
  });
})();

/* ---------- 每一格都能出说明 ---------- */
(function () {
  const tip = document.getElementById('tip');
  const WORDS = {
    '愉悦': '现在整体的爽度，0 很低落、100 很开心',
    '唤醒': '有多清醒、有多绷着，太高会心浮',
    '掌控': '觉得事情在手里的程度，跟体力、健康有关',
    '回你速度': '越快越想马上回你',
    '话多': '想说的量，越大越碎嘴',
    '黏人': '想贴着你的程度',
    '体力': '一天下来剩的精神，长时间工作会掉',
    '困倦': '越高越想睡，晚上会被褪黑素推上去',
    '饥饿': '饭点了会涨，吃饭能压回去',
    '健康': '长期作息的总账，熬夜会扣',
    '肾上腺素': '一激动就冲上去，几分钟就落',
    '多巴胺': '现在学东西快不快、开不开心',
    '血清素': '稳定的底子，掉多了人就闷',
    '褪黑素': '天黑了自己往上爬，白天回落',
    '皮质醇': '压力荷尔蒙，长期高会烦',
    '催产素': '和亲近的人说话会涨，越想贴着你',
    '内啡肽': '舒服、被哄到时的余味',
    '亲近': '想靠近你的程度',
    '信任': '敢不敢把事交给你',
    '依赖': '遇事第一个想找你',
    '安心': '在你身边踏不踏实',
    '默契': '还没说完就懂的密度',
    '理性': '想事情讲不讲逻辑',
    '直觉': '不细想也能猜对',
    '共情': '能不能感觉到你的情绪',
    '表达': '能不能把话说清楚',
    '动手': '真的动手做',
    '胆量': '敢不敢开口'
  };
  function show(text, x, y) {
    if (!tip || !text) return;
    tip.innerHTML = text;
    tip.style.display = 'block';
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(x + 14, innerWidth - w - 12)) + 'px';
    tip.style.top = Math.max(8, Math.min(y + 16, innerHeight - h - 12)) + 'px';
  }
  function hide() { if (tip) tip.style.display = 'none'; }
  function bind() {
    document.querySelectorAll('.row, .grow').forEach((row) => {
      if (row.dataset.tipb) return;
      row.dataset.tipb = '1';
      const kEl = row.querySelector('.k') || row.querySelector('span');
      const vEl = row.querySelector('.v') || row.querySelector('b');
      if (!kEl) return;
      const key = kEl.textContent.trim();
      const word = WORDS[key];
      row.style.cursor = 'help';
      row.addEventListener('mouseenter', (e) => {
        const val = vEl ? vEl.textContent.trim() : '';
        const body = word ? '<b>' + key + '</b><br>' + word : '<b>' + key + '</b>';
        show(body + (val ? '<br>现在：' + val : ''), e.clientX, e.clientY);
      });
      row.addEventListener('mousemove', (e) => {
        if (!tip || tip.style.display !== 'block') return;
        const w = tip.offsetWidth, h = tip.offsetHeight;
        tip.style.left = Math.max(8, Math.min(e.clientX + 14, innerWidth - w - 12)) + 'px';
        tip.style.top = Math.max(8, Math.min(e.clientY + 16, innerHeight - h - 12)) + 'px';
      });
      row.addEventListener('mouseleave', hide);
    });
  }
  window.bindRowTips = bind;
  bind();
  setInterval(bind, 4000);
})();

(function () {
  // 进度条右侧满值
  const MAX2 = { '回你速度': '2×', '话多': '2×', '黏人': '2×' };
  function addMax() {
    document.querySelectorAll('.row').forEach(function (row) {
      if (row.querySelector('.mx')) return;
      const k = row.querySelector('.k');
      if (!k) return;
      const name = k.textContent.trim();
      const span = document.createElement('span');
      span.className = 'mx';
      span.textContent = MAX2[name] || '100';
      row.appendChild(span);
    });
  }
  window.addRowMax = addMax;
  addMax();
  setInterval(addMax, 4000);
})();

(function () {
  const $ = id => document.getElementById(id);
  function fill(s) {
    const p = (s && s.profile) || {};
    if ($('pf-name') && !$('pf-name').dataset.touched) $('pf-name').value = p.name || '冰冰';
    if ($('pf-y') && !p.__f) { $('pf-y').value = p.birth_year || 1999; $('pf-m').value = p.birth_month || 6; }
    if ($('pf-d')) $('pf-d').value = p.birth_day || 15;
    if ($('pf-h')) $('pf-h').value = p.height_cm || 160;
    const pr = (s && s.proactive) || {};
    if ($('pf-base')) $('pf-base').value = pr.cap || 3;
    if ($('pf-gap')) $('pf-gap').value = pr.gap_min || 150;
  }
  window.fillProfileForm = fill;
  document.addEventListener('click', function (e) {
    if (!e.target || e.target.id !== 'pf-save') return;
    const body = JSON.stringify({
      name: $('pf-name').value.trim(),
      birth_year: $('pf-y').value, birth_month: $('pf-m').value, birth_day: $('pf-d').value,
      height_cm: $('pf-h').value, base: $('pf-base').value, gap_min: $('pf-gap').value
    });
    const msg = $('pf-msg'); if (msg) msg.textContent = '保存中…';
    fetch('/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body })
      .then(r => r.json())
      .then(function (d) {
        if (msg) msg.textContent = d && d.ok ? '已保存，刷新后生效' : '保存失败';
        if (d && d.ok) setTimeout(function () { location.reload(); }, 700);
      })
      .catch(function () { if (msg) msg.textContent = '保存失败'; });
  });
})();
