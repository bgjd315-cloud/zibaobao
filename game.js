// 字寶寶樂園：二上十二課、五項設施
const KEY = 'zibaobao_v1';
const INTERVAL = [0, 1, 3, 7, 14, 30];
const app = document.getElementById('app'), bg = document.getElementById('bg');
const byC = Object.fromEntries(BANK.map(c => [c.c, c]));
const OPEN = LANDS.filter(l => l.unit);
window.__miss = new Set();
const landOf = c => OPEN.find(l => l.lessons.includes(byC[c].lesson));

function load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
let S = load() || {};
S = Object.assign({ look: null, stars: 0, chars: {}, trains: {}, shifts: 0, days: [], words: {}, detect: {}, focus: 0 }, S);
const rec = c => S.chars[c] || (S.chars[c] = { box: 0, due: null, lastOk: null, combined: false, caught: false, ok: 0, near: 0, forget: 0, wrongParts: 0 });

// 測試可用 ?today=2026-11-05 模擬日期
function today() {
  const q = new URLSearchParams(location.search).get('today');
  if (q) return q;
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function addDays(s, n) {
  const [y, m, d] = s.split('-').map(Number), t = new Date(y, m - 1, d + n);
  return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
}

const esc = s => s.replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const isHan = ch => /[一-鿿]/.test(ch);
// 把文字轉成帶直排注音的字；字[注音] 指定讀音；blank(字, 注音) 決定 {字} 怎麼顯示
function z(s, blank) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '{') {
      const c = s[i + 1]; i += 2;
      let r = ZY[c] || ZYB[c];
      if (s[i + 1] === '[') { const e = s.indexOf(']', i); r = s.slice(i + 2, e); i = e; }
      out += blank ? blank(c, r) : zc(c, r);
      continue;
    }
    if (isHan(ch)) {
      let r = ZY[ch] || ZYB[ch];
      if (s[i + 1] === '[') { const e = s.indexOf(']', i); r = s.slice(i + 2, e); i = e; }
      out += zc(ch, r);
    } else out += esc(ch);
  }
  return out;
}
function zc(c, r) {
  if (!r) { window.__miss.add(c); return c; }
  return `<span class="zc">${c}${bp(r)}</span>`;
}
// 直排注音：符號由上而下，聲調在右側，輕聲點在最上面
function bp(r) {
  let s = r || '', top = '', tone = '';
  if (s[0] === '˙') { top = '<i class="qing">˙</i>'; s = s.slice(1); }
  if (/[ˊˇˋ]$/.test(s)) { tone = `<i class="tone">${s.slice(-1)}</i>`; s = s.slice(0, -1); }
  return `<span class="bp" aria-hidden="true">${top}${[...s].map(x => `<span>${x}</span>`).join('')}${tone}</span>`;
}
const plain = s => s.replace(/\[[^\]]*\]/g, '').replace(/[{}]/g, '');

// 有 Kore 配音就播音檔，還沒配到的句子先用裝置語音
let player = null;
function speak(t) {
  try {
    speechSynthesis.cancel();
    if (player) { player.pause(); player = null; }
    const k = typeof AUDIO !== 'undefined' && AUDIO[plain(t)];
    if (k) { player = new Audio('audio/' + k + '.mp3'); player.play().catch(() => {}); return; }
    const u = new SpeechSynthesisUtterance(plain(t));
    u.lang = 'zh-TW'; u.rate = .85;
    const v = speechSynthesis.getVoices().find(x => /zh[-_]TW/i.test(x.lang));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) {}
}
let actx;
function beep(ok) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    (ok ? [523, 659, 784] : [220]).forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = f; o.connect(g); g.connect(actx.destination);
      const t = actx.currentTime + i * .1;
      g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.001, t + .25);
      o.start(t); o.stop(t + .26);
    });
  } catch (e) {}
}
function confetti() {
  const colors = ['#e87f2e', '#3fa98a', '#f2b632', '#d9534f', '#8a6bc1'];
  for (let i = 0; i < 36; i++) {
    const d = document.createElement('div');
    d.className = 'confetti';
    d.style.left = Math.random() * 100 + 'vw';
    d.style.background = colors[i % 5];
    d.style.animationDelay = Math.random() * .5 + 's';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 2200);
  }
}
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pc = n => (n * 100).toFixed(1) + '%';
const setBg = n => { bg.style.backgroundImage = `url("assets/bg/${n}.webp")`; };

// ---------- 拆字：在畫布上找筆畫最少的分界線，比例跟著實際字型走 ----------
const FONT = '"ZBBKai","TW-Kai","DFKai-SB","BiauKai","Kaiti TC",serif';
const cutCache = {};
const cv0 = document.createElement('canvas'); cv0.width = cv0.height = 100;
const g0 = cv0.getContext('2d', { willReadFrequently: true });
function findCut(c, type) {
  const k = c + type;
  if (cutCache[k]) return cutCache[k];
  g0.clearRect(0, 0, 100, 100); g0.font = '100px ' + FONT; g0.fillStyle = '#000'; g0.textBaseline = 'alphabetic';
  const m = g0.measureText(c), asc = m.fontBoundingBoxAscent || 88, des = m.fontBoundingBoxDescent || 12;
  g0.fillText(c, (100 - m.width) / 2, (100 + asc - des) / 2);
  const px = g0.getImageData(0, 0, 100, 100).data, ink = new Array(100).fill(0);
  for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) if (px[(y * 100 + x) * 4 + 3] > 80) ink[type === 'L' ? x : y]++;
  let best = 50, score = 1e9;
  const from = 22, to = 75, mid = type === 'L' ? 42 : 50;
  for (let i = from; i <= to; i++) {
    const s = ink[i] + ink[i - 1] * .5 + ink[i + 1] * .5 + Math.abs(i - mid) * .12;
    if (s < score) { score = s; best = i; }
  }
  return cutCache[k] = best / 100;
}
const BOX = { W: [.30, 0, 1, .80], B: [.18, .20, .84, .86] };
function giveOf(d) {
  if (d.t === 'L') return RIGHT_RAD.includes(d.rad) ? 'R' : 'L';
  if (d.t === 'T') return HEAD_RAD.includes(d.rad) ? 'T' : 'B';
  return 'O';
}
function clipPart(c, t, part) {
  if (t === 'L') { const r = findCut(c, 'L'); return part === 'L' ? `inset(0 ${pc(1 - r)} 0 0)` : `inset(0 0 0 ${pc(r)})`; }
  if (t === 'T') { const r = findCut(c, 'T'); return part === 'T' ? `inset(0 0 ${pc(1 - r)} 0)` : `inset(${pc(r)} 0 0 0)`; }
  const [a, b, e, f] = BOX[t];
  if (part === 'O') return `polygon(evenodd,0 0,100% 0,100% 100%,0 100%,0 0,${pc(a)} ${pc(b)},${pc(a)} ${pc(f)},${pc(e)} ${pc(f)},${pc(e)} ${pc(b)},${pc(a)} ${pc(b)})`;
  return `inset(${pc(b)} ${pc(1 - e)} ${pc(1 - f)} ${pc(a)})`;
}
const other = g => ({ L: 'R', R: 'L', T: 'B', B: 'T', O: 'I' }[g]);
// 依連在一起的筆畫分組：整筆歸到同一邊，不會切出半截筆畫；分不出來才退回直線裁切
const pieceCache = {}, splitStat = {};
const SZ = 240, cvP = document.createElement('canvas');
cvP.width = cvP.height = SZ;
const gP = cvP.getContext('2d', { willReadFrequently: true });
function pieceURL(c, t, part, color) {
  const k = [c, t, part, color].join('|');
  if (pieceCache[k]) return pieceCache[k];
  gP.clearRect(0, 0, SZ, SZ); gP.font = SZ + 'px ' + FONT; gP.fillStyle = color; gP.textBaseline = 'alphabetic';
  const m = gP.measureText(c), asc = m.fontBoundingBoxAscent || SZ * .88, des = m.fontBoundingBoxDescent || SZ * .12;
  gP.fillText(c, (SZ - m.width) / 2, (SZ + asc - des) / 2);
  const img = gP.getImageData(0, 0, SZ, SZ), d = img.data, lab = new Int32Array(SZ * SZ).fill(-1);
  const cut = t === 'L' || t === 'T' ? findCut(c, t) * SZ : 0, box = BOX[t];
  const sideOf = (cx, cy) => t === 'L' ? (cx < cut ? 'L' : 'R') : t === 'T' ? (cy < cut ? 'T' : 'B')
    : (cx > box[0] * SZ && cx < box[2] * SZ && cy > box[1] * SZ && cy < box[3] * SZ ? 'I' : 'O');
  const sides = [], counts = {};
  for (let n = 0, id = 0; n < SZ * SZ; n++) {
    if (lab[n] >= 0 || d[n * 4 + 3] < 20) continue;
    const st = [n]; lab[n] = id;
    let sx = 0, sy = 0, cnt = 0, x0 = SZ, x1 = 0, y0 = SZ, y1 = 0;
    while (st.length) {
      const q = st.pop(), x = q % SZ, y = (q - x) / SZ;
      sx += x; sy += y; cnt++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= SZ || ny >= SZ) continue;
        const w = ny * SZ + nx;
        if (lab[w] < 0 && d[w * 4 + 3] >= 20) { lab[w] = id; st.push(w); }
      }
    }
    const m2 = SZ * .05;
    const side = box ? (x0 < box[0] * SZ - m2 || x1 > box[2] * SZ + m2 || y0 < box[1] * SZ - m2 || y1 > box[3] * SZ + m2 ? 'O' : 'I') : sideOf(sx / cnt, sy / cnt);
    sides[id] = side; counts[side] = (counts[side] || 0) + cnt; id++;
  }
  splitStat[c + t] = counts;
  const whole = !counts[part];
  for (let n = 0; n < SZ * SZ; n++) {
    let keep;
    if (lab[n] >= 0 && !whole) keep = sides[lab[n]] === part;
    else if (whole) { const x = n % SZ, y = (n - x) / SZ; keep = sideOf(x, y) === part; }
    else keep = false;
    if (!keep) d[n * 4 + 3] = 0;
  }
  gP.putImageData(img, 0, 0);
  return pieceCache[k] = cvP.toDataURL('image/png');
}
const pieceImg = (c, t, part, color) => `<img src="${pieceURL(c, t, part, color)}" alt="">`;
const glyphGiven = d => pieceImg(d.c, d.t, giveOf(d), '#b9531a');
const glyphOpt = (d, c) => pieceImg(c, d.t, other(giveOf(d)), '#23806a');
const canCombine = d => d.t !== 'X';
// 筆畫黏在一起分不開（任一半太少）就不拆，避免出現半個字其實幾乎是整個字
function splitOK(c, t) {
  if (t === 'X') return false;
  pieceURL(c, t, t === 'L' ? 'L' : t === 'T' ? 'T' : 'O', '#000');
  const v = Object.values(splitStat[c + t] || {}), sum = v.reduce((a, b) => a + b, 0);
  return v.length === 2 && Math.min(...v) / sum >= (BOX[t] ? .1 : .14);
}
function optionsFor(d) {
  if (HAND[d.c]) {
    const o = HAND[d.c].o.filter(c => splitOK(c, d.t));
    if (o.length === 3) return o;
  }
  const same = shuffle(BANK.filter(x => x.c !== d.c && x.t === d.t && giveOf(x) === giveOf(d))).filter(x => splitOK(x.c, x.t));
  const a = shuffle(same.filter(x => x.rad === d.rad)).slice(0, 2);
  const b = shuffle(same.filter(x => !a.includes(x)));
  return [d.c, ...a.concat(b).slice(0, 2).map(x => x.c)];
}
const tipOf = d => HAND[d.c] ? HAND[d.c].tip : `部首是「${d.rad}」。`;
const picOf = d => (HAND[d.c] && HAND[d.c].pic) || PICS[d.c] || '';
const picHtml = d => picOf(d) ? `<img class="pic" src="assets/cut/${picOf(d)}.webp" alt="">` : `<img class="pic" src="assets/cut/字寶寶_糖果.webp" alt="">`;
const fontsReady = cs => Promise.all(cs.map(c => document.fonts.load('100px ' + FONT, c))).catch(() => {});

const topbar = (back, title) => `
  <div class="top">
    <button class="btn gray" data-go="${back}">${z('回去')}</button>
    <div class="grow"><h2 class="tag">${title || ''}</h2></div>
    <div class="stars"><img src="assets/cut/獎勵_金星.webp" alt="星星">${S.stars}</div>
  </div>`;
function bind() {
  app.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { flow = null; location.hash = b.dataset.go; });
  app.querySelectorAll('[data-say]').forEach(b => b.onclick = () => speak(b.dataset.say));
}
const spBtn = t => `<button class="sp" aria-label="朗讀" data-say="${esc(plain(t))}">🔊</button>`;

// ---------- 封面、故事、選主角 ----------
const STORY = [
  ['呼嚕怪_搗蛋', '樂園裡的每個招牌，都是會說話的字寶寶。可是貪吃的呼嚕怪，把招牌咬成兩半了！'],
  ['半半_加油', '字寶寶找不到另一半，樂園就停電了。'],
  ['半半_開心', '小園長[ㄓㄤˇ]，請你和半半一起，幫字寶寶找回另一半！']
];
function home() {
  setBg('封面');
  app.innerHTML = `<div class="title">${z('字寶寶樂園')}</div>
    <div class="bottom row"><button class="btn" id="go" style="font-size:34px;padding:10px 40px">${z('開始')}</button></div>`;
  document.getElementById('go').onclick = () => { if (S.look) location.hash = 'map'; else story(0); };
}
function story(i) {
  if (i >= STORY.length) return pick();
  setBg('封面');
  const [img, t] = STORY[i];
  app.innerHTML = `<div class="bottom panel" style="margin-top:auto">
    <div class="story"><img src="assets/cut/${img}.webp" alt=""><div class="say">${z(t)}</div></div>
    <div class="row" style="margin-top:10px">${spBtn(t)}<button class="btn" id="n">${z('下一個')}</button></div></div>`;
  bind(); speak(t);
  document.getElementById('n').onclick = () => story(i + 1);
}
function pick() {
  setBg('封面');
  const L = [['園長_女孩', '女孩'], ['園長_男孩', '男孩'], ['園長_小狐狸', '小狐狸']];
  app.innerHTML = `<div class="panel" style="margin-top:auto;margin-bottom:auto"><h2 class="center">${z('選一個小園長[ㄓㄤˇ]')}</h2>
    <div class="avatars">${L.map(([a, n]) => `<button data-a="${a}"><img src="assets/cut/${a}.webp" alt="${n}"><div style="font-size:24px">${z(n)}</div></button>`).join('')}</div></div>`;
  app.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { S.look = b.dataset.a; save(); location.hash = 'map'; });
}

// ---------- 地圖、園區 ----------
function stateOf(c) { const r = S.chars[c]; return !r || !r.combined ? 0 : r.caught ? 2 : 1; }
function map() {
  setBg('園區_拍手草原');
  const q = buildTask();
  app.innerHTML = `${topbar('', z('樂園地圖'))}
    <div class="panel row" style="justify-content:space-between">
      <div style="font-size:24px">${z('招牌修好了')} <b style="font-family:var(--sans)">${BANK.filter(d => stateOf(d.c) === 2).length}／${BANK.length}</b></div>
      ${q.length ? `<button class="btn" id="task" style="font-size:28px">${z('今日任務')}</button>` : `<div style="font-size:24px">${z('今日任務做完了，太棒了！')}</div>`}
    </div>
    <div class="mapwrap">${LANDS.map(l => l.unit
      ? `<button class="pin open" style="left:${l.x}%;top:${l.y}%" data-go="land/${l.unit}">${z(l.n)}</button>`
      : `<div class="pin lock" style="left:${l.x}%;top:${l.y}%">🔒${z(l.n)}</div>`).join('')}</div>`;
  bind();
  if (q.length) document.getElementById('task').onclick = () => { flow = { q, i: 0, task: true, back: 'map' }; nextStep(); };
}
function signs(list) {
  return list.map(d => {
    const st = stateOf(d.c);
    return `<button class="sign s${st}" aria-label="${d.c}" data-say="${d.c}"><span class="g">${st || !splitOK(d.c, d.t) ? `<span>${d.c}</span>` : pieceImg(d.c, d.t, giveOf(d), '#4a3320')}</span></button>`;
  }).join('');
}
async function land(u) {
  const L = OPEN.find(l => l.unit === u);
  await fontsReady(BANK.filter(d => L.lessons.includes(d.lesson)).map(d => d.c));
  setBg(L.img);
  const list = BANK.filter(d => L.lessons.includes(d.lesson));
  const groups = L.lessons.map(n => {
    const ls = list.filter(d => d.lesson === n);
    const done = ls.filter(d => stateOf(d.c) === 2).length;
    return `<div class="group"><div class="ghead">${z(ls[0].title)} <small>${done}／${ls.length}</small></div><div class="signs">${signs(ls)}</div></div>`;
  }).join('');
  app.innerHTML = `${topbar('map', z(L.n))}
    <div class="panel"><div class="grid5">
      <button class="fac" data-go="combine/${u}"><img src="assets/bg/設施_合體工坊.webp" alt="">${z('合體工坊')}</button>
      <button class="fac" data-go="board/${u}"><img src="assets/bg/設施_魔法黑板.webp" alt="">${z('魔法黑板')}</button>
      <button class="fac" data-go="wheel/${u}"><img src="assets/bg/設施_詞語摩天輪.webp" alt="">${z('詞語摩天輪')}</button>
      <button class="fac" data-go="train/${u}"><img src="assets/bg/設施_對號小火車.webp" alt="">${z('對號小火車')}</button>
      <button class="fac" data-go="detect/${u}"><img src="assets/bg/設施_偵探小屋.webp" alt="">${z('偵探小屋')}</button>
    </div></div>
    ${u === 5 ? scanPanel() : ''}
    <div class="panel">${groups}</div>
    <div class="row"><button class="btn gray" data-go="dict">${z('詞語寶典')}</button></div>`;
  bind();
  const sb = document.getElementById('scan');
  if (sb) sb.onclick = startScan;
}
// 拍手草原：一年級的字先掃描，寫得出來就過關，寫不出來才進每日複習
const G1 = BANK.filter(d => d.lesson > 100 && d.lesson < 300);
const scanLeft = () => G1.filter(d => !(S.chars[d.c] && S.chars[d.c].scanned)).sort((a, b) => b.lesson - a.lesson);
function scanPanel() {
  const left = scanLeft().length;
  return `<div class="panel row" style="justify-content:space-between">
    <div style="font-size:24px">${z('一年級的字，寫得出來就過關！')} <b style="font-family:var(--sans)">${G1.length - left}／${G1.length}</b></div>
    ${left ? `<button class="btn" id="scan" style="font-size:26px">${z('草原大掃描')}</button>` : ''}</div>`;
}
function startScan() {
  flow = { q: scanLeft().slice(0, 10).map(d => ({ t: 'board', c: d.c })), i: 0, back: 'land/5', scan: { ok: [], bad: [] } };
  nextStep();
}
function scanDone(res) {
  setBg('園區_拍手草原');
  if (!res.bad.length) { confetti(); beep(true); }
  const t = res.bad.length ? '這些字明天再練一次就好！' : '全部都寫得出來，太棒了！';
  app.innerHTML = `${topbar('land/5', z('草原大掃描'))}<div class="panel center">
    <img src="assets/cut/半半_開心.webp" alt="" style="width:130px">
    <div class="say">${z(t)}</div>
    ${res.bad.length ? `<div class="words" style="justify-content:center;margin:8px 0">${res.bad.map(c => `<button class="wordcard" data-say="${c}">${c}</button>`).join('')}</div>` : ''}
    <div class="row" style="margin-top:10px">${scanLeft().length ? `<button class="btn" id="again">${z('下一個')}</button>` : ''}<button class="btn gray" data-go="land/5">${z('回去')}</button></div></div>`;
  bind();
  const a = document.getElementById('again');
  if (a) a.onclick = startScan;
}

// ---------- 今日任務與自由練習的流程 ----------
let flow = null;
// 順序：考卷錯字 → 家長設定的目前課次 → 二上其他課；二下要家長把課次設到二下才開始出新字
function freshOrder() {
  const score = d => (HAND[d.c] ? 0 : d.lesson === S.focus ? 1 : 2);
  return BANK.filter(d => d.lesson < 100 || (d.lesson > 300 && S.focus > 300)).sort((a, b) => score(a) - score(b) || a.lesson - b.lesson);
}
function buildTask() {
  const t = today(), q = [];
  // 複習一天最多 12 個，最久沒練的先來，避免累積後一次太長
  BANK.filter(d => S.chars[d.c] && S.chars[d.c].combined && S.chars[d.c].due && S.chars[d.c].due <= t)
    .sort((a, b) => S.chars[a.c].due < S.chars[b.c].due ? -1 : 1).slice(0, 12).forEach(d => q.push({ t: 'board', c: d.c }));
  const fresh = freshOrder().filter(d => !(S.chars[d.c] && S.chars[d.c].combined)).slice(0, 5);
  fresh.forEach(d => { if (canCombine(d)) q.push({ t: 'combine', c: d.c }); q.push({ t: 'board', c: d.c }); });
  if (q.length) {
    const u = landOf(fresh[0] ? fresh[0].c : q[0].c).unit;
    q.push({ t: 'wheel', u, c: fresh[0] ? fresh[0].c : q[0].c });
    q.push({ t: 'train', u });
    q.push({ t: 'detect', u, one: true });
  }
  return q;
}
function nextStep() {
  if (!flow || flow.i >= flow.q.length) {
    const f = flow;
    flow = null;
    if (f && f.scan) return scanDone(f.scan);
    if (f && f.task) { const t = today(); if (!S.days.includes(t)) S.days.push(t); save(); return finish(); }
    location.hash = f && f.back || 'map'; return;
  }
  const s = flow.q[flow.i++];
  if (s.t === 'combine') combine(s.c);
  else if (s.t === 'board') board(s.c);
  else if (s.t === 'wheel') wheel(s.u, s.c);
  else if (s.t === 'train') train(s.u);
  else detect(s.u, s.one);
}
const backOf = () => flow && flow.back || 'map';
function finish() {
  setBg('封面');
  confetti(); beep(true);
  const t = '今日任務做完了，太棒了！明天再來，能收服更多字寶寶。';
  app.innerHTML = `<div class="panel center" style="margin:auto"><img src="assets/cut/半半_合體.webp" alt="" style="width:180px"><div class="say">${z(t)}</div>
    <button class="btn" data-go="map">${z('回去')}</button></div>`;
  bind(); speak(t);
}
function freeList(t, u) {
  const L = OPEN.find(l => l.unit === u);
  let list = BANK.filter(d => L.lessons.includes(d.lesson));
  if (t === 'combine') list = list.filter(canCombine);
  list = shuffle(list).sort((a, b) => stateOf(a.c) - stateOf(b.c));
  flow = { q: list.map(d => ({ t, c: d.c })), i: 0, back: 'land/' + u };
}

// ---------- 合體工坊 ----------
async function combine(c) {
  const d = byC[c], r = rec(c);
  await fontsReady(HAND[c] ? HAND[c].o : [c]);
  if (!splitOK(c, d.t)) return nextStep();
  await fontsReady(BANK.filter(x => x.t === d.t).map(x => x.c));
  const opts = shuffle(optionsFor(d));
  setBg('設施_合體工坊');
  let tries = 0;
  app.innerHTML = `${topbar(backOf(), z('合體工坊'))}
    <div class="panel">
      <div class="row say">${z(d.say, (x, y) => `<span class="blank">${bp(y)}</span>`)} ${spBtn(d.say)}</div>
      <div class="work">
        <img class="buddy" src="assets/cut/半半_思考.webp" alt="">
        <div class="frame" id="f"><span class="g" id="fg">${glyphGiven(d)}</span></div>
        ${picHtml(d)}
      </div>
      <div class="msg" id="m">${z('字寶寶只剩一半，請幫它找回另一半！')}</div>
      <div class="opts" id="o">${opts.map(o => `<button class="opt" data-c="${o}"><span class="g">${glyphOpt(d, o)}</span></button>`).join('')}</div>
    </div>`;
  bind();
  const f = document.getElementById('f'), fg = document.getElementById('fg'), m = document.getElementById('m');
  app.querySelectorAll('.opt').forEach(b => b.onclick = () => {
    const pickC = b.dataset.c;
    fg.innerHTML = glyphGiven(d) + glyphOpt(d, pickC);
    if (pickC === c) {
      fg.innerHTML = `<span>${c}</span>`;
      f.className = 'frame ok'; beep(true); confetti();
      if (!tries) S.stars++;
      r.combined = true; if (!r.due) r.due = today();
      save();
      m.innerHTML = z('合體成功！') + ' ' + z(tipOf(d));
      speak(d.say);
      document.getElementById('o').innerHTML = `<button class="btn mint" id="nx">${z('下一個')}</button>`;
      document.getElementById('nx').onclick = nextStep;
    } else {
      tries++; r.wrongParts++; save();
      f.className = 'frame'; void f.offsetWidth; f.className = 'frame bad'; beep(false);
      b.classList.add('no'); b.onclick = null;
      m.innerHTML = z(`這是「${pickC}」的一部分，再找找看！`);
      setTimeout(() => { if (f.className !== 'frame ok') fg.innerHTML = glyphGiven(d); }, 700);
    }
  });
}

// ---------- 魔法黑板 ----------
function board(c) {
  const d = byC[c], r = rec(c);
  if (!r.combined) { r.combined = true; if (!r.due) r.due = today(); }
  setBg('設施_魔法黑板');
  app.innerHTML = `${topbar(backOf(), z('魔法黑板'))}
    <div class="panel">
      <div class="row say" id="s">${z(d.say, (x, y) => `<span class="blank">${bp(y)}</span>`)} ${spBtn(d.say)}</div>
      <div class="work">
        <div class="boardwrap" id="bw"><canvas id="pad"></canvas></div>
        ${picHtml(d)}
      </div>
      <div class="msg" id="m">${z('自己想一想，寫在黑板上。寫在紙上也可以！')}</div>
      <div class="row" id="a">
        <button class="btn gray" id="cl">${z('清除')}</button>
        <button class="btn" id="mg">${z('變魔法')}</button>
      </div>
    </div>`;
  bind();
  speak(d.say);
  const cv = document.getElementById('pad'), box = cv.getBoundingClientRect(), dpr = devicePixelRatio || 1;
  cv.width = box.width * dpr; cv.height = box.height * dpr;
  const g = cv.getContext('2d');
  g.scale(dpr, dpr); g.lineCap = g.lineJoin = 'round'; g.strokeStyle = '#fff'; g.lineWidth = Math.max(6, box.width / 45);
  let on = false, lx, ly;
  const pos = e => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  cv.onpointerdown = e => { on = true; cv.setPointerCapture(e.pointerId); [lx, ly] = pos(e); g.beginPath(); g.arc(lx, ly, g.lineWidth / 2, 0, 7); g.fillStyle = '#fff'; g.fill(); };
  cv.onpointermove = e => { if (!on) return; const [x, y] = pos(e); g.beginPath(); g.moveTo(lx, ly); g.lineTo(x, y); g.stroke(); lx = x; ly = y; };
  cv.onpointerup = cv.onpointercancel = () => on = false;
  document.getElementById('cl').onclick = () => g.clearRect(0, 0, box.width, box.height);
  document.getElementById('mg').onclick = () => {
    document.getElementById('bw').insertAdjacentHTML('beforeend', `<div class="ghost">${c}</div>`);
    document.getElementById('s').querySelector('.blank').outerHTML = `<span class="blank found">${c}</span>`;
    document.getElementById('m').innerHTML = z(tipOf(d)) + '<br>' + z('自己比一比，寫得對不對？');
    document.getElementById('a').innerHTML = `
      <button class="btn mint" data-r="ok">${z('全對')}</button>
      <button class="btn gray" data-r="near">${z('差一點')}</button>
      <button class="btn red" data-r="forget">${z('忘了')}</button>`;
    app.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
      if (b.dataset.r === 'forget') { rate(c, r, 'forget', true); study(); } else rate(c, r, b.dataset.r);
    });
  };
  // 忘了：先看答案，記住後遮起來再寫一次，寫對才換下一個字（紀錄仍算忘了，明天再複習）
  const msg = h => document.getElementById('m').innerHTML = h, act = h => document.getElementById('a').innerHTML = h;
  const clearPad = () => g.clearRect(0, 0, box.width, box.height);
  function study() {
    clearPad();
    if (!document.querySelector('.ghost')) document.getElementById('bw').insertAdjacentHTML('beforeend', `<div class="ghost">${c}</div>`);
    const bl = document.querySelector('#s .blank');
    bl.className = 'blank found'; bl.textContent = c;
    msg(z('看清楚答案，記住了再寫一次。') + '<br>' + z(tipOf(d)));
    act(`<button class="btn" id="memo">${z('我記住了')}</button>`);
    speak(d.say);
    document.getElementById('memo').onclick = again;
  }
  function again() {
    clearPad();
    document.querySelector('.ghost').remove();
    const bl = document.querySelector('#s .blank');
    bl.className = 'blank'; bl.innerHTML = bp(d.zy);
    msg(z('不看答案，再寫一次！'));
    act(`<button class="btn gray" id="cl2">${z('清除')}</button><button class="btn" id="mg2">${z('變魔法')}</button>`);
    document.getElementById('cl2').onclick = clearPad;
    document.getElementById('mg2').onclick = () => {
      document.getElementById('bw').insertAdjacentHTML('beforeend', `<div class="ghost">${c}</div>`);
      const b2 = document.querySelector('#s .blank');
      b2.className = 'blank found'; b2.textContent = c;
      msg(z('自己比一比，寫得對不對？'));
      act(`<button class="btn mint" id="ok2">${z('寫對了')}</button><button class="btn gray" id="re2">${z('再練一次')}</button>`);
      document.getElementById('ok2').onclick = () => { beep(true); nextStep(); };
      document.getElementById('re2').onclick = study;
    };
  }
}
function rate(c, r, how, stay) {
  const t = today();
  r[how]++;
  if (flow && flow.scan) {
    r.scanned = true; r.combined = true;
    if (how === 'ok') { r.caught = true; r.box = 2; r.lastOk = t; r.due = addDays(t, 7); S.stars++; flow.scan.ok.push(c); }
    else { r.box = 0; r.lastOk = null; r.due = addDays(t, 1); flow.scan.bad.push(c); }
    save();
    return stay ? undefined : nextStep();
  }
  let caughtNow = false;
  if (how === 'ok') {
    if (!r.lastOk) r.box = 1;
    else if (r.lastOk < t) { r.box = Math.min(r.box + 1, 5); if (!r.caught) { r.caught = true; caughtNow = true; } }
    r.lastOk = t; r.due = addDays(t, INTERVAL[r.box] || 1); S.stars++;
  } else if (how === 'near') r.due = addDays(t, 1);
  else {
    r.box = 0; r.lastOk = null; r.due = addDays(t, 1);
    if (flow && !flow.q.some((s, i) => i >= flow.i && s.t === 'board' && s.c === c)) {
      let at = flow.q.findIndex((s, i) => i >= flow.i && s.t !== 'board' && s.t !== 'combine');
      if (at < 0) at = flow.q.length;
      flow.q.splice(at, 0, { t: 'board', c });
    }
  }
  save();
  if (caughtNow) {
    confetti(); beep(true);
    const text = `隔天還寫得出來，收服字寶寶「${c}」了！招牌修好了！`;
    app.querySelector('.panel').innerHTML = `<div class="center"><div class="row"><div class="sign s2" style="width:190px"><span class="g"><span>${c}</span></span></div></div>
      <div class="say">${z(text)}</div>
      <button class="btn mint" id="nx">${z('下一個')}</button></div>`;
    document.getElementById('nx').onclick = nextStep;
    speak(text);
    return;
  }
  if (!stay) nextStep();
}

// ---------- 詞語摩天輪：中心字配成詞，再寫一次；最後玩接龍 ----------
const wordsOf = d => d.words.map(w => ({ text: plain(w), marked: w })).filter(w => w.text.length === 2 && w.text.includes(d.c));
const ALLWORDS = BANK.flatMap(d => wordsOf(d).map(w => ({ ...w, c: d.c })));
const uniq = a => [...new Set(a)];
function wheel(u, center) {
  const L = OPEN.find(l => l.unit === u);
  const pool = BANK.filter(d => L.lessons.includes(d.lesson) && wordsOf(d).length >= 2);
  const d = center && byC[center] && wordsOf(byC[center]).length >= 1 ? byC[center] : shuffle(pool)[0];
  const list = wordsOf(d).slice(0, 3);
  setBg('設施_詞語摩天輪');
  let idx = 0;
  const others = uniq(ALLWORDS.filter(w => !w.text.includes(d.c)).map(w => w.text[0]));
  function tilesFor(w) {
    const need = w.text.replace(d.c, '');
    return shuffle([need, ...shuffle(others.filter(x => x !== need)).slice(0, 5)]);
  }
  function render(msg) {
    const w = list[idx], need = w.text.replace(d.c, '');
    const shown = w.marked.replace(new RegExp(need + '\\[([^\\]]*)\\]'), '{' + need + '}[$1]');
    app.innerHTML = `${topbar(flow ? backOf() : 'land/' + u, z('詞語摩天輪'))}
      <div class="panel">
        <div class="wheelwrap">
          <div class="wheel" style="--r:${idx * 40}deg"><div class="hub">${d.c}</div>
          ${[0, 1, 2, 3, 4, 5].map(i => {
            const a = i * 60, on = i < idx ? list[i] : null;
            return `<div class="cabin ${on ? 'lit' : ''}" style="--a:${a}deg"><span>${on ? on.text : ''}</span></div>`;
          }).join('')}</div>
        </div>
        <div class="row say">${z(shown, (x, y) => `<span class="blank">${bp(y)}</span>`)} ${spBtn(w.text)}</div>
        <div class="msg" id="m">${msg || z('幫中間的字找朋友，配成一個詞語！')}</div>
        <div class="tiles">${tilesFor(w).map(t => `<button class="tile" data-t="${t}">${t}</button>`).join('')}</div>
      </div>`;
    bind();
    speak(w.text);
    app.querySelectorAll('.tile').forEach(b => b.onclick = () => {
      if (b.dataset.t === need) {
        beep(true); S.words[w.text] = w.marked; S.stars++; save();
        idx++;
        if (idx >= list.length) return done();
        render(z('配對成功！再找一個！'));
      } else { beep(false); b.disabled = true; document.getElementById('m').innerHTML = z('這樣不是詞語，再想想看！'); }
    });
  }
  function done() {
    confetti();
    chain(u, d);
  }
  render();
}
// 詞語接龍：從剛學的詞接下去
function chain(u, d) {
  const first = shuffle(wordsOf(d))[0];
  let cur = first, count = 0;
  function pickNext() {
    const tail = cur.text[1];
    // 接龍只接同音，避免「師長」接「長城」這種破音字
    const ra = w => (w.marked.match(/\[([^\]]*)\]/g) || []).map(x => x.slice(1, -1));
    const tailR = ra(cur)[1];
    const ok = ALLWORDS.filter(w => w.text[0] === tail && w.text !== cur.text && ra(w)[0] === tailR);
    if (!ok.length || count >= 3) return end();
    const right = shuffle(ok)[0];
    const wrong = shuffle(ALLWORDS.filter(w => w.text[0] !== tail)).slice(0, 2);
    app.querySelector('.panel').innerHTML = `
      <div class="row say">${z(cur.marked)} <span style="font-family:var(--sans)">→</span> <span class="blank">${tail}</span></div>
      <div class="msg">${z('詞語接龍：找一個開頭是這個字的詞語！')}</div>
      <div class="tiles">${shuffle([right, ...wrong]).map(w => `<button class="btn gray wd" data-w="${w.text}">${z(w.marked)}</button>`).join('')}</div>`;
    app.querySelectorAll('.wd').forEach(b => b.onclick = () => {
      if (b.dataset.w === right.text) { beep(true); S.words[right.text] = right.marked; S.stars++; save(); cur = right; count++; pickNext(); }
      else { beep(false); b.disabled = true; b.style.opacity = .35; }
    });
  }
  function end() {
    app.querySelector('.panel').innerHTML = `<div class="center"><div class="say">${z('詞語都放進寶典了！')}</div>
      <button class="btn mint" id="nx">${z('下一個')}</button></div>`;
    document.getElementById('nx').onclick = () => { if (flow) nextStep(); else wheel(u); };
  }
  pickNext();
}
function dict() {
  setBg('園區_故事城堡');
  const ws = Object.values(S.words);
  app.innerHTML = `${topbar('map', z('詞語寶典'))}<div class="panel">
    ${ws.length ? `<div class="words">${ws.map(w => `<button class="wordcard" data-say="${esc(plain(w))}">${z(w)}</button>`).join('')}</div>` : `<div class="say center">${z('還沒有詞語，去摩天輪找一找！')}</div>`}
  </div>`;
  bind();
}

// ---------- 對號小火車 ----------
function train(u) {
  setBg('設施_對號小火車');
  const pool = u === 5 ? PASSAGES : PASSAGES.filter(p => p.unit === u);
  const next = pool.find(p => (S.trains[p.id] || 0) < 2) || shuffle(pool)[0];
  runTrain(next, Math.min(S.trains[next.id] || 0, 1), u);
}
function runTrain(p, level, u) {
  const ans = [...p.text.matchAll(/\{(.)\}/g)].map(m => m[1]);
  const fill = ans.map(() => null);
  let cur = 0;
  const tiles = shuffle([...new Set([...ans, ...p.extra])]);
  let idx;
  function render(checked) {
    idx = 0;
    const text = z(p.text, (c, zy) => {
      const i = idx++;
      const on = level === 0 && i === cur;
      return `<span class="gap${on ? ' on' : ''}">${level === 0 ? `<b>${i + 1}</b>` : ''}${bp(zy)}</span>`;
    });
    app.innerHTML = `${topbar(flow ? backOf() : 'land/' + u, z('對號小火車'))}
      <div class="panel">
        <div class="row" style="justify-content:space-between"><div class="passage" style="flex:1;min-width:0">${text}</div>${spBtn(p.text)}</div>
        <div class="train" id="tr"><div class="engine"></div>${ans.map((a, i) => {
          const cls = checked ? (fill[i] === a ? 'right' : 'wrong') : (i === cur ? 'on' : '');
          return `<button class="car ${cls}" data-i="${i}"><i>${i + 1}</i>${fill[i] || ''}</button>`;
        }).join('')}</div>
        <div class="msg" id="m">${level === 0 ? z('看亮起來的格子，把字放進一樣號碼的車廂。') : z('考卷模式：一格一格用手指對好，再放進車廂！')}</div>
        <div class="tiles">${tiles.map(t => `<button class="tile" data-t="${t}" ${fill.includes(t) ? 'disabled' : ''}>${t}</button>`).join('')}</div>
        <div class="row" style="margin-top:12px" id="act">${fill.every(Boolean) ? `<button class="btn mint" id="goT">${z('發車')}</button>` : ''}</div>
      </div>`;
    bind();
    app.querySelectorAll('.car').forEach(b => b.onclick = () => {
      const i = +b.dataset.i;
      if (fill[i]) fill[i] = null;
      cur = i; render();
    });
    app.querySelectorAll('.tile').forEach(b => b.onclick = () => place(b.dataset.t, b));
    const g = document.getElementById('goT');
    if (g) g.onclick = check;
  }
  function place(t, b) {
    if (cur < 0 || fill[cur]) cur = fill.findIndex(x => !x);
    if (cur < 0) return;
    if (level === 0 && t !== ans[cur]) {
      beep(false);
      document.getElementById('m').innerHTML = z('看一下注音，再找找看！');
      b.disabled = true;
      return;
    }
    fill[cur] = t;
    const n = fill.findIndex((x, i) => !x && i > cur);
    cur = n >= 0 ? n : fill.findIndex(x => !x);
    render();
  }
  function check() {
    const wrong = ans.map((a, i) => fill[i] !== a ? i : -1).filter(i => i >= 0);
    if (!wrong.length) {
      beep(true); confetti();
      S.trains[p.id] = (S.trains[p.id] || 0) + 1; S.stars += 2; save();
      document.getElementById('tr').classList.add('go');
      document.getElementById('m').innerHTML = z('全對，小火車發車了！');
      speak(p.text);
      document.getElementById('act').innerHTML = `<button class="btn mint" id="nx">${z('下一個')}</button>`;
      document.getElementById('nx').onclick = () => { if (flow) nextStep(); else train(u); };
      return;
    }
    const shifted = wrong.some(i => fill[i] === ans[i - 1] || fill[i] === ans[i + 1]);
    if (shifted) S.shifts++;
    save(); beep(false);
    wrong.forEach(i => fill[i] = null);
    cur = wrong[0];
    render();
    app.querySelectorAll('.car').forEach(b => { if (wrong.includes(+b.dataset.i)) b.classList.add('wrong'); });
    document.getElementById('m').innerHTML = shifted ? z('這個字寫對了，可是跑到隔壁車廂了！再用手指對一次。') : z('紅色的車廂再想一想。');
  }
  render();
}

// ---------- 偵探小屋 ----------
function detect(u, one) {
  setBg('設施_偵探小屋');
  const idx = shuffle(DETECT.map((q, i) => i)).sort((a, b) => (S.detect[a] || 0) - (S.detect[b] || 0))[0];
  const q = DETECT[idx], hasWrong = plain(q.q).includes('錯誤');
  let stamped = !hasWrong;
  function html() {
    const [qa, qw, qb] = q.q.split(/(錯(?:\[[^\]]*\])?誤(?:\[[^\]]*\])?)/);
    const qText = hasWrong && !stamped
      ? `${z(qa)}<button id="stamp" class="stamp">${z(qw)}</button>${z(qb)}`
      : z(q.q);
    return `${topbar(flow ? backOf() : 'land/' + u, z('偵探小屋'))}
      <div class="panel">
        ${q.t ? `<div class="passage">${z(q.t)}</div><hr>` : ''}
        <div class="row say">${qText} ${spBtn((q.t ? q.t + ' ' : '') + q.q)}</div>
        <div class="msg" id="m">${hasWrong && !stamped ? z('題目問「錯誤」的！先蓋紅章在這兩個字上。') : ''}</div>
        <div class="choices">${q.o.map((o, i) => `<button class="choice" data-i="${i}" ${stamped ? '' : 'disabled'}>${z(o)}</button>`).join('')}</div>
        <div class="row" id="act" style="margin-top:12px"></div>
      </div>`;
  }
  function draw() {
    app.innerHTML = html(); bind();
    const st = document.getElementById('stamp');
    if (st) st.onclick = () => { stamped = true; beep(true); draw(); };
    app.querySelectorAll('.choice').forEach(b => b.onclick = () => {
      if (+b.dataset.i === q.a) {
        beep(true); b.classList.add('right'); S.stars++; S.detect[idx] = (S.detect[idx] || 0) + 1; save();
        document.getElementById('m').innerHTML = z('答對了！') + ' ' + z(q.why);
        app.querySelectorAll('.choice').forEach(x => x.disabled = true);
        document.getElementById('act').innerHTML = `<button class="btn mint" id="nx">${z('下一個')}</button>`;
        document.getElementById('nx').onclick = () => { if (flow) nextStep(); else detect(u); };
      } else { beep(false); b.classList.add('wrongc'); b.disabled = true; document.getElementById('m').innerHTML = z('再想一想！'); }
    });
  }
  draw();
}

// ---------- 家長頁（前台沒有入口）與拆字檢查頁 ----------
function parent() {
  bg.style.backgroundImage = 'none';
  const name = { 0: '未練', 1: '練習中', 2: '已收服' };
  const seen = BANK.filter(d => S.chars[d.c] && S.chars[d.c].combined);
  app.innerHTML = `<div class="panel" style="font-family:var(--sans)"><h2>家長頁</h2>
    <p>完成任務 ${S.days.length} 天；已練 ${seen.length}／${BANK.length} 字；已收服 ${BANK.filter(d => stateOf(d.c) === 2).length} 字；一年級掃描 ${G1.length - scanLeft().length}／${G1.length} 字，要補 ${G1.filter(d => S.chars[d.c] && S.chars[d.c].scanned && !S.chars[d.c].caught).map(d => d.c).join('') || '無'}；詞語寶典 ${Object.keys(S.words).length} 個；小火車跳格 ${S.shifts} 次。</p>
    <p><label>目前學校上到：<select id="fc"><option value="0">不指定</option>${[...Array.from({ length: 12 }, (_, i) => [i + 1, '二上第 ' + (i + 1) + ' 課']), ...Array.from({ length: 12 }, (_, i) => [301 + i, '二下第 ' + (i + 1) + ' 課'])].map(([v, n]) => `<option value="${v}" ${S.focus === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>（考卷錯字之後，先練這一課；設到二下才會出二下的新字）</p>
    <div class="tablewrap"><table><tr><th>字</th><th>課</th><th>狀態</th><th>下次複習</th><th>全對</th><th>差一點</th><th>忘了</th><th>拼錯部件</th></tr>
    ${seen.map(d => { const r = S.chars[d.c]; return `<tr><td style="font-family:var(--kai);font-size:26px">${d.c}${HAND[d.c] ? '＊' : ''}</td><td>${d.lesson > 300 ? '二下' + (d.lesson - 300) : d.lesson > 200 ? '一下' + (d.lesson - 200) : d.lesson > 100 ? '一上' + (d.lesson - 100) : '二上' + d.lesson}</td><td>${name[stateOf(d.c)]}</td><td>${r.due || '—'}</td><td>${r.ok}</td><td>${r.near}</td><td>${r.forget}</td><td>${r.wrongParts}</td></tr>`; }).join('') || '<tr><td colspan="8">還沒有練習紀錄</td></tr>'}
    </table></div><p>＊是考卷錯字。</p>
    <p style="font-size:14px;color:#7a5c3e">字型來源：數位發展部，CNS11643中文標準交換碼全字庫網站，https://www.cns11643.gov.tw（全字庫正楷體，依政府資料開放授權條款第 1 版使用，僅取遊戲用字）。</p>
    <div class="row" style="margin-top:12px"><button class="btn gray" data-go="">回遊戲</button><button class="btn red" id="rs">清除所有進度</button></div></div>`;
  bind();
  document.getElementById('fc').onchange = e => { S.focus = +e.target.value; save(); };
  document.getElementById('rs').onclick = () => { if (confirm('確定清除所有進度？清除後無法復原。')) { try { localStorage.removeItem(KEY); } catch (e) {} location.hash = ''; location.reload(); } };
}
async function debugPage() {
  bg.style.backgroundImage = 'none';
  await fontsReady(BANK.map(d => d.c));
  const list = BANK.filter(canCombine);
  window.__bad = list.filter(d => !splitOK(d.c, d.t)).map(d => d.c).join('');
  app.innerHTML = `<div class="panel" style="padding:4px"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:3px;font-size:0">${list.map(d => `<span style="display:flex;background:#fff;border:1px solid #ddd"><span class="g" style="font-size:46px">${glyphGiven(d)}</span><span class="g" style="font-size:46px">${glyphOpt(d, d.c)}</span></span>`).join('')}</div></div>`;
}

function route() {
  const [h, arg] = location.hash.replace('#', '').replace(/^\//, '').split('/');
  const u = +arg || 1;
  window.scrollTo(0, 0);
  if (h === 'map') return map();
  if (h === 'land') return land(u);
  if (h === 'combine' || h === 'board') { freeList(h, u); return nextStep(); }
  if (h === 'wheel') { flow = null; return wheel(u); }
  if (h === 'train') { flow = null; return train(u); }
  if (h === 'detect') { flow = null; return detect(u); }
  if (h === 'dict') return dict();
  if (h === 'parent') return parent();
  if (h === 'debug') return debugPage();
  home();
}
addEventListener('hashchange', route);
route();
