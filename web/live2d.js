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

/* ---------- 情绪曲线 ---------- */
function drawCurve(curve) {
  const cv = document.getElementById('curveCv');
  if (!cv || !cv.getContext || !curve || !curve.length) return;
  // 按容器实际宽度 × 像素比重设画布，手机窄屏也不会被拉伸糊掉
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = Math.max(200, Math.round(cv.clientWidth || 380));
  const cssH = Math.round(cv.clientHeight || 96);
  if (cv.width !== Math.round(cssW * dpr) || cv.height !== Math.round(cssH * dpr)) {
    cv.width = Math.round(cssW * dpr);
    cv.height = Math.round(cssH * dpr);
  }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = cssW, H = cssH;
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,.14)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const y = Math.round(H * i / 4) + 0.5;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  const line = (key, color) => {
    const pts = [];
    const span = Math.max(curve.length - 1, 23);   // 按 24 格铺，攒得少就只占左边
    curve.forEach((p, i) => {
      if (typeof p[key] !== 'number') return;
      pts.push([i * W / span,
                H - Math.max(0, Math.min(100, p[key])) / 100 * H]);
    });
    if (!pts.length) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach(([x, y], i) => { i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
    ctx.fillStyle = color;
    pts.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 6.2832); ctx.fill(); });
  };
  line('v', '#ff9ec4');
  line('a', '#8ecbff');
  if (curve.length < 3) {
    ctx.fillStyle = 'rgba(120,130,160,.55)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('每 15 分钟记一格 · 现在 ' + curve.length + ' 格', W / 2, H / 2 + 34);
  }
}

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

  // 激素：雌激素 / 孕激素 + 周期第几天
  const hm = s.hormones || {};
  if (hm.estrogen !== undefined) set('est', hm.estrogen);
  if (hm.progesterone !== undefined) set('prg', hm.progesterone);
  const cyc = s.cycle || {};
  if (cyc.day) {
    const cbar = document.getElementById('s-cyc');
    if (cbar) cbar.style.width = Math.round(cyc.day / 28 * 100) + '%';
    const ck = document.getElementById('k-cyc');
    if (ck) ck.textContent = cyc.stage || '周期';
    const cv2 = document.getElementById('v-cyc');
    if (cv2) cv2.textContent = cyc.day;
    const cm = document.getElementById('m-cyc');
    if (cm) cm.textContent = '/28';
  }
  drawCurve(s.curve);

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
    const zb = document.getElementById('zodiacBirth'); if (zb) { const _p = s.profile || {}; zb.textContent = (_p.birth_year && _p.birth_month && _p.birth_day) ? (_p.birth_year + '.' + _p.birth_month + '.' + _p.birth_day) : (s.zodiac.birth || ''); }
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
    const t1u = document.getElementById('d-together-unit');
    if (t1) {
      const hasT = !(s.days.together === null || s.days.together === undefined);
      t1.textContent = hasT ? String(s.days.together) : '—';
      if (t1u) t1u.style.display = hasT ? '' : 'none';
    }
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

/* 事件按钮：从内核拿全量 17 种（带英文小字），点了就走 /event */
async function buildKindButtons() {
  const box = document.querySelector('.btns');
  if (!box) return;
  let kinds = null;
  try {
    const r = await fetch('/api/kinds', { cache: 'no-store' });
    if (r.ok) kinds = await r.json();
  } catch (e) { }
  if (!kinds) return;                       // 拿不到就留原来的 8 个
  const frag = document.createDocumentFragment();
  Object.entries(kinds).forEach(([k, v]) => {
    const b = document.createElement('button');
    b.dataset.kind = k;
    b.innerHTML = v.cn + (v.en ? '<i>' + v.en + '</i>' : '');
    frag.appendChild(b);
  });
  box.innerHTML = '';
  box.appendChild(frag);
  bindKindButtons();
}

function bindKindButtons() {
  document.querySelectorAll('.btns button').forEach(b => {
    if (b.dataset.bound) return;
    b.dataset.bound = '1';
    b.addEventListener('click', async () => {
      const r = await fetch('/event', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: b.dataset.kind, intensity: 1 })
      });
      if (r.ok) applyState(await r.json());
    });
  });
}

bindKindButtons();
buildKindButtons();

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

function showStillImage(src, tip) {
  const wrap = document.getElementById('stageWrap');
  if (!wrap || document.getElementById('stillImg')) return;
  const box = document.createElement('div');
  box.id = 'stillImg';
  box.style.cssText = 'position:absolute;inset:52px 12px 12px;display:flex;flex-direction:column;' +
    'align-items:center;justify-content:center;gap:10px;pointer-events:none;';
  box.innerHTML = '<img src="' + src + '" style="max-width:100%;max-height:78%;object-fit:contain">' +
    (tip ? '<div style="font-size:12.5px;color:var(--text2);text-align:center">' + tip + '</div>' : '');
  wrap.appendChild(box);
  const cv = document.getElementById('stageCv') || document.querySelector('#stageWrap canvas');
  if (cv) cv.style.display = 'none';
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
  if (!path) {
    // 没有 Live2D 模型：有上传的形象图就放图，没有就放默认那条大肥鱼
    let av = '';
    try {
      const s = await (await fetch('/api/state', { cache: 'no-store' })).json();
      av = (s.profile && s.profile.avatar) || '';
    } catch (e) { }
    showStillImage(av || '/assets/default.png',
      av ? '' : '默认先给你一条大肥鱼　点右上角 ⚙ 换形象');
    return;
  }
  try {
    model = await PIXI.live2d.Live2DModel.from(path, {
      autoInteract: true,
    });
  } catch (e) {
    let av = '';
    try {
      const s = await (await fetch('/api/state', { cache: 'no-store' })).json();
      av = (s.profile && s.profile.avatar) || '';
    } catch (e2) { }
    showStillImage(av || '/assets/default.png', '模型加载失败，先给你看张图');
    return;
  }
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
  ctx.clearRect(0, 0, W, H);
  const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.75);
  bg.addColorStop(0, '#141d38');
  bg.addColorStop(1, '#05080f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const view = window.STAR_VIEW || (window.STAR_VIEW = { yaw: 0.55, pitch: 0.42 });
  const cam = window.STAR_CAM || (window.STAR_CAM = { z: 1, tx: 0, ty: 0, tz: 1, ttx: 0, tty: 0 });
  cam.z += (cam.tz - cam.z) * 0.14;
  cam.tx += (cam.ttx - cam.tx) * 0.14;
  cam.ty += (cam.tty - cam.ty) * 0.14;
  const camv = big ? cam : { z: 1, tx: 0, ty: 0 };
  const groups = [...new Set(mems.map(m => m.group))];
  const cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) * (big ? 0.40 : 0.34);
  const camZ = R * 3.4;

  function proj(p) {
    let x = p[0], y = p[1], z = p[2];
    const cyw = Math.cos(view.yaw), syw = Math.sin(view.yaw);
    let x1 = x * cyw - z * syw;
    let z1 = x * syw + z * cyw;
    const cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
    let y1 = y * cp - z1 * sp;
    let z2 = y * sp + z1 * cp;
    const k = camZ / (camZ + z2);
    const X0 = cx + x1 * k, Y0 = cy + y1 * k;
    return { x: cx + camv.z * (X0 - cx) + camv.tx + (window.__starOffX || 0), y: cy + camv.z * (Y0 - cy) + camv.ty, z: z2, k: k * camv.z };
  }
  const tilt = 0.22;
  function orbitPoint(rad, ang) {
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad;
    const y = z * tilt;
    return [x, -y, z];
  }

  // 太阳：人格
  const sunR = R * 0.10;
  window.__starOffX = 0;
  const sunX = cx + camv.tx + (window.__starOffX || 0), sunY = cy + camv.ty;
  const sunBig = false;
  const sunRz = sunR * (1 + (camv.z - 1) * 0.55);
  const glowR = sunRz * 4.2;
  const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, glowR);
  glow.addColorStop(0, 'rgba(255,240,205,.95)');
  glow.addColorStop(0.22, 'rgba(255,206,128,.55)');
  glow.addColorStop(0.6, 'rgba(255,170,90,.16)');
  glow.addColorStop(1, 'rgba(255,150,70,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(sunX, sunY, glowR, 0, Math.PI * 2); ctx.fill();
  const body = ctx.createRadialGradient(sunX - sunRz * 0.2, sunY - sunRz * 0.25, sunRz * 0.1, sunX, sunY, sunRz);
  body.addColorStop(0, 'rgba(255,247,214,1)');
  body.addColorStop(0.42, 'rgba(255,216,140,1)');
  body.addColorStop(0.78, 'rgba(255,178,86,1)');
  body.addColorStop(1, 'rgba(255,150,64,1)');
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(sunX, sunY, sunRz, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  ctx.beginPath(); ctx.arc(sunX - sunRz * 0.25, sunY - sunRz * 0.3, sunRz * 0.34, 0, Math.PI * 2); ctx.fill();

  const nodes = [];
  nodes.push({ x: sunX, y: sunY, r: sunRz + (big ? 14 : 8), kind: 'sun', m: { title: '人格', group: '核心', desc: '人格卡就是这颗太阳，其他都是绕着它转的' }, col: '#ffd98a' });

  // 行星：每个分组一颗，轨道由近到远
  const planets = groups.map((g, i) => {
    const rad = R * (0.40 + i * 0.17);
    const spin = (0.16 - i * 0.012) * (i % 2 ? -1 : 1);
    return { g: g, rad: rad, spin: spin, i: i, col: GROUP_COLOR[g] || '#9fb8e8' };
  });

  // 轨道
  planets.forEach(p => {
    ctx.beginPath();
    for (let s = 0; s <= 72; s++) {
      const a = s / 72 * Math.PI * 2;
      const q = proj(orbitPoint(p.rad, a));
      if (s === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
    }
    ctx.strokeStyle = 'rgba(140,175,225,.13)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // 收集绘制项：行星 + 卫星
  const draws = [];
  planets.forEach(p => {
    const ang = t * p.spin + p.i * 1.7;
    const world = orbitPoint(p.rad, ang);
    const sp = proj(world);
    const depth = (sp.z + R) / (2 * R);
    const pR = (big ? 7 : 4.6) + depth * (big ? 5 : 3);
    draws.push({ kind: 'planet', p: p, sp: sp, depth: depth, r: pR, world: world });
    const kids = mems.filter(m => m.group === p.g);
    kids.forEach((m, idx) => {
      const spread = (window.STAR_FOCUS && window.STAR_FOCUS !== '\u4eba\u683c') ? 1.95 : 1;
      const mr = (pR + (big ? 22 : 12) + idx * (big ? 13 : 7)) * spread * (sunBig ? 0.8 : 1);
      const ma = t * (0.55 + idx * 0.05) * (idx % 2 ? 1 : -1) + idx * 2.1;
      const tot = Math.cos(ma) * mr;
      const w2 = [world[0] + tot * 0.9, world[1] - Math.sin(ma) * mr * 0.55 + Math.cos(ma) * mr * tilt * 0.9, world[2] + Math.sin(ma) * mr * 0.9];
      const s2 = proj(w2);
      const d2 = (s2.z + R) / (2 * R);
      draws.push({ kind: 'moon', m: m, sp: s2, depth: d2, r: ((big ? 2.6 : 1.7) + d2 * (big ? 3.2 : 2)) * (sunBig ? 0.78 : 1), col: GROUP_COLOR[p.g] || '#9fb8e8' });
    });
  });

  draws.sort((a, b) => b.depth - a.depth);

  draws.forEach(d => {
    const on = pick && d.kind === 'moon' && pick === d.m;
    if (d.kind === 'planet') {
      const p = d.p;
      const pg = ctx.createRadialGradient(d.sp.x - d.r * 0.35, d.sp.y - d.r * 0.4, d.r * 0.15, d.sp.x, d.sp.y, d.r * 1.3);
      pg.addColorStop(0, '#ffffff');
      pg.addColorStop(0.45, p.col);
      pg.addColorStop(1, 'rgba(40,60,100,.9)');
      ctx.beginPath(); ctx.arc(d.sp.x, d.sp.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = pg; ctx.fill();
      ctx.strokeStyle = 'rgba(230,240,255,' + (0.25 + d.depth * 0.4).toFixed(2) + ')';
      ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(210,225,245,' + (0.45 + d.depth * 0.5).toFixed(2) + ')';
      ctx.font = (big ? 13 : 10) + 'px "Microsoft YaHei UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.g, d.sp.x, d.sp.y + d.r + (big ? 16 : 12));
      nodes.push({ x: d.sp.x, y: d.sp.y, r: d.r + (big ? 10 : 6), kind: 'planet', m: { title: p.g, group: '行星', desc: '这一组记忆绕它转' }, col: p.col });
    } else {
      const col = d.col;
      ctx.globalAlpha = 0.42 + d.depth * 0.58;
      ctx.beginPath(); ctx.arc(d.sp.x, d.sp.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = on ? '#ffffff' : col; ctx.fill();
      if (on || big) {
        ctx.strokeStyle = on ? '#ffffff' : col + '88';
        ctx.lineWidth = on ? 2 : 1; ctx.stroke();
      }
      ctx.globalAlpha = 1;
      nodes.push({ x: d.sp.x, y: d.sp.y, r: d.r + (big ? 7 : 4), kind: 'moon', m: d.m, col: col });
    }
  });

  const FOC = window.STAR_FOCUS || null;
  if (FOC) {
    const fn = nodes.find(n => n.m && n.m.title === FOC);
    if (fn) {
      ctx.beginPath(); ctx.arc(fn.x, fn.y, fn.r * 4.4, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,214,140,.35)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.arc(fn.x, fn.y, fn.r * 2.7, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(fn.x, fn.y, fn.r * 0.9, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff'; ctx.fill();
    }
  }

  if (window.STAR_FOCUS) {
    view.yaw += 0.0012;
    let f = null;
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].m && nodes[i].m.title === window.STAR_FOCUS) { f = nodes[i]; break; }
    }
    if (f) {
      cam.tx += (cx - f.x) * 0.10;
      cam.ty += (cy - f.y) * 0.10;
      cam.ttx = cam.tx; cam.tty = cam.ty;
    }
  }
  window.STAR_NODES = nodes;
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
  '<div class="bighint">点空白或按 Esc 关掉 · 主星是我，中星是记忆，外圈以后待办也用这里</div>' +
  '<div class="bigpanel" id="bigPanel"></div></div>';
document.body.appendChild(starOverlay);
const bigClose = document.createElement('button');
bigClose.className = 'bigclose'; bigClose.textContent = '×';
bigClose.title = '关闭';
starOverlay.querySelector('.bigcard').appendChild(bigClose);
bigClose.addEventListener('click', function () { starOverlay.classList.remove('on'); var p = document.getElementById('bigPanel'); if (p) { p.classList.remove('on'); p.innerHTML = ''; } });
const bigPanelStyle = document.createElement('style');
bigPanelStyle.textContent = '#starOverlay .bigpanel{position:absolute;right:14px;top:52px;bottom:56px;width:min(300px,36%);' +
  'overflow:auto;padding:12px 14px;border-radius:12px;background:rgba(9,15,28,.72);border:1px solid rgba(150,190,255,.18);' +
  'color:#e6eeff;font-size:12.5px;line-height:1.65;display:none;backdrop-filter:blur(3px);}' +
  '#starOverlay .bigpanel.on{display:block;}' +
  '#starOverlay .bigpanel h4{margin:0 0 8px;font-size:13.5px;color:#ffd98a;font-weight:600;}' +
  '#starOverlay .bigpanel .it{padding:6px 0;border-top:1px dashed rgba(150,190,255,.16);}' +
  '#starOverlay .bigpanel .it:first-of-type{border-top:0;}' +
  '#starOverlay .bigpanel b{display:block;color:#fff;font-weight:600;margin-bottom:2px;}' +
  '#starOverlay .bigpanel span{color:#b9c8e6;}' +
  '#starOverlay .bigpanel .empty{color:#8fa0be;}';
document.head.appendChild(bigPanelStyle);
const bigReset = document.createElement('button');
bigReset.className = 'bigreset'; bigReset.textContent = '回正';
bigReset.title = '把视角和焦距复位';
bigReset.style.cssText = 'position:absolute;right:54px;top:10px;height:28px;padding:0 12px;' +
  'border:none;border-radius:14px;background:rgba(255,255,255,.16);color:#eaf1ff;' +
  'font-size:13px;line-height:28px;cursor:pointer;letter-spacing:1px;';
starOverlay.querySelector('.bigcard').appendChild(bigReset);
bigReset.addEventListener('click', ev => { ev.stopPropagation(); window.starResetAll(); });
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
});
// 星图大图：鼠标移到星星上直接出说明
starOverlay.addEventListener('mousemove', ev => {
  const tp = document.getElementById('tip');
  if (!tp) return;
  if (ev.target.id !== 'starMapBig') { tp.style.display = 'none'; return; }
  const rr = starBig.getBoundingClientRect();
  const xx = ev.clientX - rr.left, yy = ev.clientY - rr.top;
  const lim2 = 26 * 26;
  const hit = (window.STAR_NODES || []).find(n => (n.x - xx) ** 2 + (n.y - yy) ** 2 < lim2);
  if (!hit) { tp.style.display = 'none'; return; }
  tp.innerHTML = '<b>' + hit.m.title + '</b><br>' + hit.m.group + (hit.m.desc ? '<br>' + hit.m.desc : '');
  tp.style.display = 'block';
  const tw = tp.offsetWidth || 200, th = tp.offsetHeight || 60;
  tp.style.left = Math.max(8, Math.min(ev.clientX + 14, innerWidth - tw - 12)) + 'px';
  tp.style.top = Math.max(8, Math.min(ev.clientY + 16, innerHeight - th - 12)) + 'px';
});
starOverlay.addEventListener('mouseleave', () => {
  const tp = document.getElementById('tip'); if (tp) tp.style.display = 'none';
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
    root.setProperty('--title', mixBlack(t.accent, 0.42));
    root.setProperty('--text', mixBlack(t.accent, 0.28));
    root.setProperty('--text2', mixBlack(t.accent, 0.16));
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
  let pfDirty = false;
  function fill(s) {
    if (pfDirty) return;
    const p = (s && s.profile) || {};
    if ($('pf-name') && !$('pf-name').dataset.touched) $('pf-name').value = p.name || '冰冰';
    if ($('pf-y') && !p.__f) { $('pf-y').value = p.birth_year || 1999; $('pf-m').value = p.birth_month || 6; }
    if ($('pf-d')) $('pf-d').value = p.birth_day || 15;
    if ($('pf-h')) $('pf-h').value = p.height_cm || 160;
    if ($('pf-together') && !$('pf-together').dataset.touched) $('pf-together').value = p.together_since || '';
    const pr = (s && s.proactive) || {};
    if ($('pf-base')) $('pf-base').value = pr.cap || 3;
    if ($('pf-gap')) $('pf-gap').value = pr.gap_min || 150;
  }
  window.fillProfileForm = fill;
  ['pf-name','pf-y','pf-m','pf-d','pf-h','pf-base','pf-gap','pf-together'].forEach(function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('focus', function () { pfDirty = true; });
    el.addEventListener('input', function () { pfDirty = true; });
  });
  document.addEventListener('click', function (e) {
    if (!e.target || e.target.id !== 'pf-save') return;
    const body = JSON.stringify({
      name: $('pf-name').value.trim(),
      birth_year: $('pf-y').value, birth_month: $('pf-m').value, birth_day: $('pf-d').value,
      height_cm: $('pf-h').value, base: $('pf-base').value, gap_min: $('pf-gap').value,
      together_since: $('pf-together') ? $('pf-together').value : ''
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

(function () {
  var tip = document.getElementById('tip');
  if (!tip) return;
  function show(el, ev) {
    var t = el.getAttribute('data-tip');
    if (!t) return;
    tip.textContent = t; tip.style.display = 'block';
    var w = tip.offsetWidth, hh = tip.offsetHeight;
    var x = Math.min(ev.clientX + 14, innerWidth - w - 12);
    var y = Math.min(ev.clientY + 16, innerHeight - hh - 12);
    tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px';
  }
  document.addEventListener('mousemove', function (ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest('[data-tip]') : null;
    if (el) show(el, ev);
    else if (tip.dataset.auto === '1') { tip.style.display = 'none'; delete tip.dataset.auto; }
  }, true);
  document.addEventListener('mouseover', function (ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest('[data-tip]') : null;
    if (el) tip.dataset.auto = '1';
  }, true);
})();

// ---- 星图拖动旋转 ----
(function () {
  function bind(cv) {
    if (!cv || cv.dataset.drag === '1') return;
    cv.dataset.drag = '1';
    cv.style.cursor = 'grab';
    let dragging = false, lx = 0, ly = 0, sx = 0, sy = 0, moved = 0;
    cv.addEventListener('pointerdown', function (e) {
      dragging = true; lx = e.clientX; ly = e.clientY; sx = e.clientX; sy = e.clientY; moved = 0;
      cv.style.cursor = 'grabbing';
      if (cv.setPointerCapture) { try { cv.setPointerCapture(e.pointerId); } catch (_) { } }
    });
    cv.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      const v = window.STAR_VIEW || (window.STAR_VIEW = { yaw: 0.55, pitch: 0.42 });
      moved += Math.abs(e.clientX - lx) + Math.abs(e.clientY - ly);
      v.yaw += (e.clientX - lx) * 0.008;
      v.pitch = Math.max(-0.9, Math.min(1.1, v.pitch + (e.clientY - ly) * 0.006));
      lx = e.clientX; ly = e.clientY;
    });
    function stop() {
      if (dragging && moved < 8 && window.starPick) window.starPick(sx, sy);
      dragging = false; cv.style.cursor = 'grab';
    }
    cv.addEventListener('pointerup', stop);
    cv.addEventListener('pointercancel', stop);
    cv.addEventListener('pointerleave', stop);
  }
  window.starDrag = bind;
  setInterval(function () {
    bind(document.getElementById('starMapBig'));
  }, 1200);
})();


// ---- 星图：点节点聚焦、显示说明 ----
(function () {
  function bigInfo() {
    const o = document.getElementById('starOverlay');
    return o ? o.querySelector('.bighint') : null;
  }
  window.starResetAll = function () {
    const c = window.STAR_CAM;
    if (c) { c.tz = 1; c.tx = 0; c.ty = 0; c.ttx = 0; c.tty = 0; }
    const v = window.STAR_VIEW;
    if (v) { v.yaw = 0.55; v.pitch = 0.42; }
    window.STAR_FOCUS = null;
    const h = bigInfo();
    if (h) h.textContent = '点太阳看人格 · 点行星看这一组 · 鼠标移到卫星上看每一条 · 拖动可转视角';
  };
  window.starResetCam = window.starResetAll;
  window.starPick = function (clientX, clientY) {
    const cv = document.getElementById('starMapBig');
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    const x = clientX - r.left, y = clientY - r.top;
    const nodes = window.STAR_NODES || [];
    var sun = null;
    nodes.forEach(function (n) { if (n.kind === 'sun') sun = n; });
    var hit = null, best = 1e18;
    if (sun) {
      const dd = (sun.x - x) ** 2 + (sun.y - y) ** 2;
      const sr = Math.max(sun.r * 1.25, Math.min(r.width, r.height) * 0.13);
      if (dd < sr * sr) hit = sun;
    }
    if (!hit) {
      const lim = (Math.min(r.width, r.height) * 0.16) ** 2;
      nodes.forEach(function (n) {
        if (!n.m) return;
        if (n.kind !== 'planet') return;
        const d = (n.x - x) ** 2 + (n.y - y) ** 2;
        if (d < lim && d < best) { best = d; hit = n; }
      });
    }
    const h = bigInfo();
    const cam = window.STAR_CAM;
    const panel = document.getElementById('bigPanel');
    const fillPanel = function (title, items) {
      if (!panel) return;
      if (!items || !items.length) { panel.classList.remove('on'); panel.innerHTML = ''; return; }
      var html = '<h4>' + title + '</h4>';
      items.forEach(function (it) {
        html += '<div class="it"><b>' + (it.t || '') + '</b><span>' + (it.d || '') + '</span></div>';
      });
      panel.innerHTML = html;
      panel.classList.add('on');
    };
    const reset = function () {
      if (cam) { cam.tz = 1; cam.ttx = 0; cam.tty = 0; }
      window.STAR_FOCUS = null;
      if (h) h.textContent = '点太阳看人格 · 点行星看这一组 · 鼠标移到卫星上看每一条 · 拖动可转视角';
      fillPanel('', null);
    };
    if (hit) {
      if (window.STAR_FOCUS === hit.m.title) { reset(); return; }
      window.STAR_FOCUS = hit.m.title;
      if (hit.kind === 'sun') {
        if (cam) { cam.tz = 2.2; cam.tx = 0; cam.ty = 0; cam.ttx = 0; cam.tty = 0; }
        if (h) h.textContent = window.STAR_SUN_TEXT ||
          '人格 · 核心 · 中间这颗是我。别的行星是一组组记忆，卫星是每一条。点一下回总览。';
        fillPanel('人格 · 我', window.STAR_SUN_ITEMS || [
          { t: '这颗太阳', d: '人格卡就是它，所有记忆都绕着它转。再点一下太阳回总览。' },
          { t: '行星', d: '每一颗是一组记忆：经历、约定、反馈、参考、我自己、用户。' },
          { t: '卫星', d: '每一条具体的事。鼠标移上去看标题和内容。' }
        ]);
      } else {
        if (cam) { cam.tz = 2.2; }
        var cnt = 0;
        (window.STAR_NODES || []).forEach(function (n) {
          if (n.kind === 'moon' && n.m && n.m.group === hit.m.title) cnt++;
        });
        if (h) h.textContent = hit.m.title + ' · 行星 · 这一组 ' + cnt + ' 条，鼠标移上去看每一条';
        var items = [];
        (window.STAR_NODES || []).forEach(function (n) {
          if (n.kind === 'moon' && n.m && n.m.group === hit.m.title) {
            items.push({ t: n.m.title || '', d: n.m.desc || '' });
          }
        });
        fillPanel(hit.m.title + ' · ' + items.length + ' 条', items);
      }
    }
  };
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      window.STAR_FOCUS = null;
      const c = window.STAR_CAM;
      if (c) { c.tz = 1; c.ttx = 0; c.tty = 0; }
      const p = document.getElementById('bigPanel');
      if (p) { p.classList.remove('on'); p.innerHTML = ''; }
    }
  });
})();
