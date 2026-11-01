// 字寶寶樂園 試玩版
const KEY = 'zibaobao_v1';
const INTERVAL = [0, 1, 3, 7, 14, 30];
const app = document.getElementById('app'), bg = document.getElementById('bg');
const byC = Object.fromEntries(CHARS.map(c => [c.c, c]));
window.__miss = new Set();

function load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
let S = load() || { look: null, stars: 0, chars: {}, trains: {}, shifts: 0, days: [] };
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
// 把文字轉成帶注音的 ruby；blank(字, 注音) 決定 {字} 怎麼顯示
function z(s, blank) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '{') {
      const c = s[i + 1]; i += 2;
      out += blank ? blank(c, ZY[c]) : rubyOf(c, ZY[c]);
      continue;
    }
    if (/[一-鿿辶]/.test(ch)) {
      let r = ZY[ch];
      if (s[i + 1] === '[') { const e = s.indexOf(']', i); r = s.slice(i + 2, e); i = e; }
      out += rubyOf(ch, r);
    } else out += esc(ch);
  }
  return out;
}
function rubyOf(c, r) {
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

function speak(t) {
  try {
    speechSynthesis.cancel();
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

// 字形拆半：用 clip-path 裁真正的字，字形才會和標準字一致
function clipGiven(d) {
  if (d.s === 'lr') return `inset(0 ${pc(1 - d.r)} 0 0)`;
  if (d.s === 'tb') return d.give === 'T' ? `inset(0 0 ${pc(1 - d.r)} 0)` : `inset(${pc(d.r)} 0 0 0)`;
  const [a, b, c, e] = d.box;
  return `polygon(evenodd,0 0,100% 0,100% 100%,0 100%,0 0,${pc(a)} ${pc(b)},${pc(a)} ${pc(e)},${pc(c)} ${pc(e)},${pc(c)} ${pc(b)},${pc(a)} ${pc(b)})`;
}
function clipOther(d, own) {
  if (d.s === 'lr') return `inset(0 0 0 ${pc(own ?? d.r)})`;
  if (d.s === 'tb') { const r = own ?? d.r; return d.give === 'T' ? `inset(${pc(r)} 0 0 0)` : `inset(0 0 ${pc(1 - r)} 0)`; }
  const [a, b, c, e] = own || d.box;
  return `inset(${pc(b)} ${pc(1 - c)} ${pc(1 - e)} ${pc(a)})`;
}
const optOf = o => Array.isArray(o) ? o : [o, undefined];
const glyphGiven = d => `<span class="give" style="clip-path:${clipGiven(d)}">${d.c}</span>`;
const glyphOpt = (d, o) => { const [c, own] = optOf(o); return `<span class="put" style="clip-path:${clipOther(d, own)}">${c}</span>`; };

const topbar = (back, title) => `
  <div class="top">
    <button class="btn gray" data-go="${back}">${z('回去')}</button>
    <div class="grow"><h2 style="display:inline-block;background:rgba(255,250,240,.96);border:2px solid var(--line);border-radius:14px;padding:2px 14px">${title || ''}</h2></div>
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
  ['半半_開心', '小園長，請你和半半一起，幫字寶寶找回另一半！']
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
  app.innerHTML = `<div class="panel" style="margin-top:auto;margin-bottom:auto"><h2 class="center">${z('選一個小園長')}</h2>
    <div class="avatars">${L.map(([a, n]) => `<button data-a="${a}"><img src="assets/cut/${a}.webp" alt="${n}"><div style="font-size:24px">${z(n)}</div></button>`).join('')}</div></div>`;
  app.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { S.look = b.dataset.a; save(); location.hash = 'map'; });
}

// ---------- 地圖、園區 ----------
function map() {
  setBg('園區_拍手草原');
  app.innerHTML = `${topbar('', z('樂園地圖'))}
    <div class="mapwrap">${LANDS.map(l => l.open
      ? `<button class="pin open" style="left:${l.x}%;top:${l.y}%" data-go="land">${z(l.n)}</button>`
      : `<div class="pin lock" style="left:${l.x}%;top:${l.y}%">🔒${z(l.n)}</div>`).join('')}</div>`;
  bind();
}
function stateOf(c) { const r = S.chars[c]; return !r || !r.combined ? 0 : r.caught ? 2 : 1; }
function signs() {
  return CHARS.map(d => {
    const st = stateOf(d.c);
    return `<button class="sign s${st}" aria-label="${d.c}" data-say="${d.c}"><span class="g">${st ? `<span>${d.c}</span>` : `<span style="clip-path:${clipGiven(d)}">${d.c}</span>`}</span></button>`;
  }).join('');
}
function land() {
  setBg('園區_新鮮事市集');
  const caught = CHARS.filter(d => stateOf(d.c) === 2).length;
  const q = buildTask();
  app.innerHTML = `${topbar('map', z('新鮮事市集'))}
    <div class="panel">
      <div class="row" style="justify-content:space-between">
        <div class="story"><img src="assets/cut/${S.look || '園長_女孩'}.webp" alt="" style="width:76px"><div style="font-size:24px;line-height:2">${z('招牌修好了')} <b style="font-family:var(--sans)">${caught}／${CHARS.length}</b></div></div>
        ${q.length ? `<button class="btn" id="task" style="font-size:30px">${z('今日任務')}</button>` : `<div style="font-size:24px;line-height:2">${z('今日任務做完了，太棒了！')}</div>`}
      </div>
      <div class="signs">${signs()}</div>
    </div>
    <div class="panel"><div class="grid3">
      <button class="fac" data-go="combine"><img src="assets/bg/設施_合體工坊.webp" alt="">${z('合體工坊')}</button>
      <button class="fac" data-go="board"><img src="assets/bg/設施_魔法黑板.webp" alt="">${z('魔法黑板')}</button>
      <button class="fac" data-go="train"><img src="assets/bg/設施_對號小火車.webp" alt="">${z('對號小火車')}</button>
    </div></div>`;
  bind();
  if (q.length) document.getElementById('task').onclick = () => { flow = { q, i: 0, task: true }; nextStep(); };
}

// ---------- 今日任務與自由練習的流程 ----------
let flow = null;
function buildTask() {
  const t = today(), q = [];
  const seen = CHARS.filter(d => S.chars[d.c] && S.chars[d.c].combined);
  seen.filter(d => S.chars[d.c].due && S.chars[d.c].due <= t).forEach(d => q.push({ t: 'board', c: d.c }));
  const fresh = CHARS.filter(d => !(S.chars[d.c] && S.chars[d.c].combined)).slice(0, 5);
  fresh.forEach(d => { q.push({ t: 'combine', c: d.c }); q.push({ t: 'board', c: d.c }); });
  if (q.length) q.push({ t: 'train' });
  return q;
}
function nextStep() {
  if (!flow || flow.i >= flow.q.length) {
    const wasTask = flow && flow.task;
    flow = null;
    if (wasTask) { const t = today(); if (!S.days.includes(t)) S.days.push(t); save(); return finish(); }
    location.hash = 'land'; route(); return;
  }
  const s = flow.q[flow.i++];
  if (s.t === 'combine') combine(s.c);
  else if (s.t === 'board') board(s.c);
  else train();
}
function finish() {
  setBg('園區_新鮮事市集');
  confetti(); beep(true);
  const t = '今日任務做完了，太棒了！明天再來，能收服更多字寶寶。';
  app.innerHTML = `<div class="panel center" style="margin:auto"><img src="assets/cut/半半_合體.webp" alt="" style="width:180px"><div class="say">${z(t)}</div>
    <button class="btn" data-go="land">${z('回去')}</button></div>`;
  bind(); speak(t);
}
const freeList = t => flow = { q: CHARS.slice().sort((a, b) => stateOf(a.c) - stateOf(b.c)).map(d => ({ t, c: d.c })), i: 0 };

// ---------- 合體工坊 ----------
function combine(c) {
  const d = byC[c], r = rec(c);
  setBg('設施_合體工坊');
  const sent = d.say;
  let tries = 0;
  app.innerHTML = `${topbar('land', z('合體工坊'))}
    <div class="panel">
      <div class="row say">${z(sent, () => `<span class="blank">${bp(ZY[c])}</span>`)} ${spBtn(sent)}</div>
      <div class="work">
        <img class="buddy" src="assets/cut/半半_思考.webp" alt="">
        <div class="frame" id="f"><span class="g" id="fg">${glyphGiven(d)}</span></div>
        <img class="pic" src="assets/cut/${d.pic}.webp" alt="" id="pic">
      </div>
      <div class="msg" id="m">${z('字寶寶只剩一半，請幫它找回另一半！')}</div>
      <div class="opts" id="o">${shuffle(d.o).map(o => `<button class="opt" data-c="${optOf(o)[0]}"><span class="g">${glyphOpt(d, o)}</span></button>`).join('')}</div>
    </div>`;
  bind();
  const f = document.getElementById('f'), fg = document.getElementById('fg'), m = document.getElementById('m');
  app.querySelectorAll('.opt').forEach(b => b.onclick = () => {
    const pickC = b.dataset.c, o = d.o.find(x => optOf(x)[0] === pickC);
    fg.innerHTML = glyphGiven(d) + glyphOpt(d, o);
    if (pickC === c) {
      fg.innerHTML = `<span>${c}</span>`;
      f.className = 'frame ok'; beep(true); confetti();
      if (!tries) S.stars++;
      r.combined = true; if (!r.due) r.due = today();
      save();
      m.innerHTML = z('合體成功！') + ' ' + z(d.tip);
      speak(plain(sent));
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
  setBg('設施_魔法黑板');
  app.innerHTML = `${topbar('land', z('魔法黑板'))}
    <div class="panel">
      <div class="row say" id="s">${z(d.say, () => `<span class="blank">${bp(ZY[c])}</span>`)} ${spBtn(d.say)}</div>
      <div class="work">
        <div class="boardwrap" id="bw"><canvas id="pad"></canvas></div>
        <img class="pic" src="assets/cut/${d.pic}.webp" alt="">
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
    document.getElementById('m').innerHTML = z(d.tip) + '<br>' + z('自己比一比，寫得對不對？');
    document.getElementById('a').innerHTML = `
      <button class="btn mint" data-r="ok">${z('全對')}</button>
      <button class="btn gray" data-r="near">${z('差一點')}</button>
      <button class="btn red" data-r="forget">${z('忘了')}</button>`;
    app.querySelectorAll('[data-r]').forEach(b => b.onclick = () => rate(c, r, b.dataset.r));
  };
}
function rate(c, r, how) {
  const t = today();
  r[how]++;
  let caughtNow = false;
  if (how === 'ok') {
    if (!r.lastOk) r.box = 1;
    else if (r.lastOk < t) { r.box = Math.min(r.box + 1, 5); if (!r.caught) { r.caught = true; caughtNow = true; } }
    r.lastOk = t; r.due = addDays(t, INTERVAL[r.box] || 1); S.stars++;
  } else if (how === 'near') r.due = addDays(t, 1);
  else {
    r.box = 0; r.lastOk = null; r.due = addDays(t, 1);
    if (flow && !flow.q.some((s, i) => i >= flow.i && s.t === 'board' && s.c === c)) {
      const at = flow.q.length && flow.q[flow.q.length - 1].t === 'train' ? flow.q.length - 1 : flow.q.length;
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
  nextStep();
}

// ---------- 對號小火車 ----------
function train() {
  setBg('設施_對號小火車');
  const next = PASSAGES.find(p => (S.trains[p.id] || 0) < 2) || PASSAGES[Math.floor(Math.random() * PASSAGES.length)];
  runTrain(next, Math.min(S.trains[next.id] || 0, 1));
}
function runTrain(p, level) {
  const ans = [...p.text.matchAll(/\{(.)\}/g)].map(m => m[1]);
  const fill = ans.map(() => null);
  let cur = 0;
  const tiles = shuffle([...ans, ...p.extra]);
  let idx;
  function render(checked) {
    idx = 0;
    const text = z(p.text, (c, zy) => {
      const i = idx++;
      const on = level === 0 && i === cur;
      return `<span class="gap${on ? ' on' : ''}">${level === 0 ? `<b>${i + 1}</b>` : ''}${bp(zy)}</span>`;
    });
    app.innerHTML = `${topbar('land', z('對號小火車'))}
      <div class="panel">
        <div class="row" style="justify-content:space-between"><div class="passage" style="flex:1;min-width:0">${text}</div>${spBtn(p.text)}</div>
        <div class="train" id="tr"><div class="engine"></div>${ans.map((a, i) => {
          const cls = checked ? (fill[i] === a ? 'right' : 'wrong') : (i === cur ? 'on' : '');
          return `<button class="car ${cls}" data-i="${i}"><i>${i + 1}</i>${fill[i] || ''}</button>`;
        }).join('')}</div>
        <div class="msg" id="m">${level === 0 ? z('看亮起來的格子，把字放進一樣號碼的車廂。') : z('考卷模式：一格一格用手指對好，再放進車廂！')}</div>
        <div class="tiles">${tiles.map(t => `<button class="tile" data-t="${t}" ${fill.includes(t) ? 'disabled' : ''}>${t}</button>`).join('')}</div>
        <div class="row" style="margin-top:12px">${fill.every(Boolean) ? `<button class="btn mint" id="goT">${z('發車')}</button>` : ''}</div>
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
      document.getElementById('m').innerHTML = z(`看一下注音，再找找看！`);
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
      speak(plain(p.text));
      const row = app.querySelector('#goT').parentElement;
      row.innerHTML = `<button class="btn mint" id="nx">${z('下一個')}</button>`;
      document.getElementById('nx').onclick = () => { if (flow) nextStep(); else { location.hash = 'land'; route(); } };
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

// ---------- 家長頁（前台沒有入口）與拆字檢查頁 ----------
function parent() {
  bg.style.backgroundImage = 'none';
  const name = { 0: '未練', 1: '練習中', 2: '已收服' };
  app.innerHTML = `<div class="panel" style="font-family:var(--sans)"><h2>家長頁</h2>
    <p>完成任務 ${S.days.length} 天；對號小火車跳格 ${S.shifts} 次。</p>
    <div class="tablewrap"><table><tr><th>字</th><th>課次</th><th>狀態</th><th>下次複習</th><th>全對</th><th>差一點</th><th>忘了</th><th>拼錯部件</th></tr>
    ${CHARS.map(d => { const r = S.chars[d.c] || {}; return `<tr><td style="font-family:var(--kai);font-size:26px">${d.c}</td><td>${d.lesson}</td><td>${name[stateOf(d.c)]}</td><td>${r.due || '—'}</td><td>${r.ok || 0}</td><td>${r.near || 0}</td><td>${r.forget || 0}</td><td>${r.wrongParts || 0}</td></tr>`; }).join('')}
    </table></div>
    <div class="row" style="margin-top:12px"><button class="btn gray" data-go="">回遊戲</button><button class="btn red" id="rs">清除所有進度</button></div></div>`;
  bind();
  document.getElementById('rs').onclick = () => { if (confirm('確定清除所有進度？清除後無法復原。')) { try { localStorage.removeItem(KEY); } catch (e) {} location.hash = ''; location.reload(); } };
}
function debugPage() {
  bg.style.backgroundImage = 'none';
  app.innerHTML = `<div class="panel"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:6px;font-size:0">${CHARS.map(d => `
    <div style="display:flex;gap:4px;border:1px solid #ccc;padding:4px">
    ${d.o.map(o => `<span class="g" style="font-size:100px;background:#fff">${glyphGiven(d)}${glyphOpt(d, o)}</span>`).join('')}</div>`).join('')}</div></div>`;
}

function route() {
  const h = location.hash.replace('#', '').replace(/^\//, '');
  window.scrollTo(0, 0);
  if (h === 'map') return map();
  if (h === 'land') return land();
  if (h === 'combine') { freeList('combine'); return nextStep(); }
  if (h === 'board') { freeList('board'); return nextStep(); }
  if (h === 'train') { flow = null; return train(); }
  if (h === 'parent') return parent();
  if (h === 'debug') return debugPage();
  home();
}
addEventListener('hashchange', route);
route();
