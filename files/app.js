/* ══════════════════════════════════════
   STATE
══════════════════════════════════════ */
let tasks    = JSON.parse(localStorage.getItem('tf5_tasks') || '[]');
let settings = JSON.parse(localStorage.getItem('tf5_cfg')   || '{"theme":"dark","pomos":0}');
let activity = JSON.parse(localStorage.getItem('tf5_log')   || '[]');

let filt    = 'all';
let catFilt = null;
let editId  = null;

let pomoSec   = 25 * 60;
let pomoTmr   = null;
let pomoOn    = false;
let pomoCount = parseInt(localStorage.getItem('tf5_pomo') || '0');
let inFocus   = false;

/* ══════════════════════════════════════
   SIDEBAR TOGGLE
══════════════════════════════════════ */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

/* ══════════════════════════════════════
   SLIDER CONFIG PER VIEW
══════════════════════════════════════ */
const SLIDERS = {
  tasks: [
    { l: 'All',          fn: "setFilt('all',this)" },
    { l: 'Active',       fn: "setFilt('active',this)" },
    { l: 'Done',         fn: "setFilt('done',this)" },
    { l: 'High Priority',fn: "setFilt('high',this)" },
    { l: 'Overdue',      fn: "setFilt('overdue',this)" },
  ],
  dashboard:    [{ l: 'Overview', fn: '' }, { l: 'Goals', fn: '' }],
  insights:     [{ l: 'Metrics',  fn: '' }, { l: 'Log', fn: '' }],
  achievements: [{ l: 'All',      fn: '' }, { l: 'Earned', fn: '' }],
};
const VIEW_TITLES = {
  tasks: 'Tasks', dashboard: 'Dashboard',
  insights: 'Insights', achievements: 'Achievements',
};

function setSlider(v) {
  const cfg = SLIDERS[v] || [];
  const w   = document.getElementById('slider-wrap');
  if (!cfg.length) { w.innerHTML = ''; return; }
  w.innerHTML = `<div class="tab-slider">${
    cfg.map((t, i) =>
      `<button class="ttab${i === 0 ? ' on' : ''}"
        onclick="${t.fn}${t.fn ? ';' : ''}activateTab(this)">${t.l}</button>`
    ).join('')
  }</div>`;
}
function activateTab(el) {
  el.closest('.tab-slider').querySelectorAll('.ttab')
    .forEach(t => t.classList.remove('on'));
  el.classList.add('on');
}

/* ══════════════════════════════════════
   BOOT
══════════════════════════════════════ */
window.addEventListener('load', () => {
  if (settings.theme === 'light') document.body.classList.add('light');
  setSlider('tasks');
  setTimeout(() => {
    document.getElementById('loader').classList.add('out');
    document.getElementById('app').classList.add('on');
    renderTasks();
    updateStats();
    renderStreak();
    initDrag();
    syncDots();
  }, 2100);
});

/* ══════════════════════════════════════
   VIEW SWITCHING
══════════════════════════════════════ */
function goView(v, el) {
  document.querySelectorAll('.view').forEach(x => x.classList.remove('on'));
  document.getElementById('view-' + v).classList.add('on');
  document.querySelectorAll('.ni').forEach(x => x.classList.remove('on'));
  if (el) el.classList.add('on');
  document.getElementById('tb-title').textContent = VIEW_TITLES[v] || v;
  catFilt = null;
  setSlider(v);
  if (v === 'dashboard')    renderDashboard();
  if (v === 'insights')     renderInsights();
  if (v === 'achievements') renderAchievements();
}

function setCat(cat, el) {
  catFilt = cat;
  document.querySelectorAll('.ni').forEach(x => x.classList.remove('on'));
  if (el) el.classList.add('on');
  document.querySelectorAll('.view').forEach(x => x.classList.remove('on'));
  document.getElementById('view-tasks').classList.add('on');
  document.getElementById('tb-title').textContent = cat;
  setSlider('tasks');
  renderTasks();
}

/* ══════════════════════════════════════
   MODAL
══════════════════════════════════════ */
function openModal(id)  { document.getElementById(id).classList.add('on'); }
function closeModal(id) { document.getElementById(id).classList.remove('on'); }

/* ══════════════════════════════════════
   TASK CRUD
══════════════════════════════════════ */
function openTaskModal(id = null) {
  editId = id;
  document.getElementById('sub-inputs').innerHTML = '';
  if (id) {
    const t = tasks.find(x => x.id === id);
    document.getElementById('modalTitle').textContent   = 'Edit Task';
    document.getElementById('fi-title').value           = t.title;
    document.getElementById('fi-notes').value           = t.notes || '';
    document.getElementById('fi-priority').value        = t.priority;
    document.getElementById('fi-cat').value             = t.category;
    document.getElementById('fi-due').value             = t.due || '';
    (t.subtasks || []).forEach(s => addSubInput(s.title));
  } else {
    document.getElementById('modalTitle').textContent   = 'New Task';
    document.getElementById('fi-title').value           = '';
    document.getElementById('fi-notes').value           = '';
    document.getElementById('fi-priority').value        = 'medium';
    document.getElementById('fi-cat').value             = 'Work';
    document.getElementById('fi-due').value             = '';
  }
  openModal('taskModal');
  setTimeout(() => document.getElementById('fi-title').focus(), 200);
}

function addSubInput(val = '') {
  const w = document.getElementById('sub-inputs');
  const d = document.createElement('div');
  d.className = 'sub-inp-row';
  d.innerHTML = `<input class="fi" placeholder="Subtask..." value="${esc(val)}">
    <button class="rm-sub" onclick="this.parentElement.remove()">✕</button>`;
  w.appendChild(d);
}

function saveTask() {
  const title = document.getElementById('fi-title').value.trim();
  if (!title) { toast('Please enter a task title'); return; }
  const subs = [...document.querySelectorAll('#sub-inputs .fi')]
    .map(i => ({ title: i.value.trim(), done: false })).filter(s => s.title);
  if (editId) {
    const t = tasks.find(x => x.id === editId);
    const old = t.subtasks || [];
    t.title    = title;
    t.notes    = document.getElementById('fi-notes').value;
    t.priority = document.getElementById('fi-priority').value;
    t.category = document.getElementById('fi-cat').value;
    t.due      = document.getElementById('fi-due').value;
    t.subtasks = subs.map((s, i) => ({ ...s, done: old[i]?.done || false }));
    toast('Task updated'); log('Edited: ' + title);
  } else {
    tasks.unshift({
      id: uid(), title,
      notes:    document.getElementById('fi-notes').value,
      priority: document.getElementById('fi-priority').value,
      category: document.getElementById('fi-cat').value,
      due:      document.getElementById('fi-due').value,
      done: false, created: new Date().toISOString(), subtasks: subs
    });
    toast('Task created'); log('Created: ' + title);
  }
  save(); renderTasks(); updateStats(); closeModal('taskModal');
}

function deleteTask(id) {
  const t = tasks.find(x => x.id === id);
  tasks = tasks.filter(x => x.id !== id);
  save(); renderTasks(); updateStats();
  toast('Task deleted'); if (t) log('Deleted: ' + t.title);
}

function toggleTask(id) {
  const t = tasks.find(x => x.id === id);
  t.done = !t.done; t.completedAt = t.done ? new Date().toISOString() : null;
  save(); renderTasks(); updateStats(); renderStreak();
  if (t.done) { log('Completed: ' + t.title); toast('Task completed'); }
}

function toggleSub(tid, idx) {
  const t = tasks.find(x => x.id === tid);
  t.subtasks[idx].done = !t.subtasks[idx].done;
  save(); renderTasks();
}

function quickAdd() {
  const el = document.getElementById('quickInput');
  const v  = el.value.trim(); if (!v) return;
  tasks.unshift({ id: uid(), title: v, priority: 'medium', category: 'Work',
    done: false, created: new Date().toISOString(), subtasks: [] });
  el.value = ''; save(); renderTasks(); updateStats();
  log('Quick added: ' + v); toast('Task added');
}

/* ══════════════════════════════════════
   RENDER TASKS
══════════════════════════════════════ */
function getFiltered() {
  let t = [...tasks];
  if (catFilt) t = t.filter(x => x.category === catFilt);
  const q = (document.getElementById('searchInput')?.value || '').toLowerCase();
  if (q) t = t.filter(x => x.title.toLowerCase().includes(q) || (x.notes||'').toLowerCase().includes(q));
  if (filt === 'active')  t = t.filter(x => !x.done);
  if (filt === 'done')    t = t.filter(x => x.done);
  if (filt === 'high')    t = t.filter(x => x.priority === 'high');
  if (filt === 'overdue') t = t.filter(x => x.due && !x.done && new Date(x.due) < new Date());
  const s = document.getElementById('sortSel')?.value || 'created';
  if (s === 'priority') { const o = { high:0,medium:1,low:2 }; t.sort((a,b) => o[a.priority]-o[b.priority]); }
  if (s === 'due') t.sort((a,b) => { if(!a.due) return 1; if(!b.due) return -1; return new Date(a.due)-new Date(b.due); });
  return t;
}

function renderTasks() {
  const list = document.getElementById('taskList');
  const t    = getFiltered();
  document.getElementById('sb-cnt').textContent = tasks.filter(x => !x.done).length;
  if (!t.length) {
    list.innerHTML = `<div class="empty">
      <div class="e-ico"><svg viewBox="0 0 22 22"><rect x="2" y="3" width="18" height="16" rx="2"/><path d="M6 8h10M6 12h6"/></svg></div>
      <div class="e-title">No tasks here</div>
      <div class="e-desc">Create a task or adjust filters</div>
    </div>`;
    return;
  }
  list.innerHTML = t.map(task => {
    const od  = task.due && !task.done && new Date(task.due) < new Date();
    const dl  = task.due ? new Date(task.due).toLocaleDateString('en-IN', { day:'numeric', month:'short' }) : '';
    const sub = task.subtasks || [];
    const sd  = sub.filter(s => s.done).length;
    const barH = sub.length
      ? `<div class="sub-bar">
           <div class="sb-track"><div class="sb-fill" style="width:${Math.round(sd/sub.length*100)}%"></div></div>
           <span class="sb-cnt">${sd}/${sub.length}</span>
         </div>` : '';
    const subsH = sub.length
      ? `<div class="sub-list">${sub.map((s,i) =>
          `<div class="sub-item">
            <div class="sch ${s.done?'done':''}" onclick="toggleSub('${task.id}',${i})"></div>
            <span class="stxt ${s.done?'done':''}">${esc(s.title)}</span>
          </div>`).join('')}</div>` : '';
    return `<div class="titem" data-id="${task.id}">
      <div class="pdot ${task.priority==='high'?'pd-h':task.priority==='medium'?'pd-m':'pd-l'}"></div>
      <div class="tcheck ${task.done?'done':''}" onclick="toggleTask('${task.id}')"></div>
      <div class="tbody">
        <div class="ttitle ${task.done?'done':''}">${esc(task.title)}</div>
        <div class="tmeta">
          <span class="tag t-${task.priority}">${task.priority.toUpperCase()}</span>
          <span class="tag t-cat">${task.category}</span>
          ${dl ? `<span class="t-due ${od?'od':''}">${od?'Overdue · ':''}${dl}</span>` : ''}
        </div>
        ${barH}${subsH}
      </div>
      <div class="t-acts">
        <button class="tab-btn" onclick="openTaskModal('${task.id}')" title="Edit">
          <svg viewBox="0 0 14 14"><path d="M9.5 1.5l3 3L4 13H1v-3z"/></svg>
        </button>
        <button class="tab-btn del" onclick="deleteTask('${task.id}')" title="Delete">
          <svg viewBox="0 0 14 14"><path d="M2 4h10M5 4V2h4v2M5 7v3M9 7v3"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
  initDrag();
}

function setFilt(f, el) {
  filt = f;
  document.querySelectorAll('#fTabsRow .ftab').forEach(x => x.classList.remove('on'));
  if (el) el.classList.add('on');
  renderTasks();
}

/* ══════════════════════════════════════
   DRAG & DROP
══════════════════════════════════════ */
function initDrag() {
  const el = document.getElementById('taskList');
  if (!el || !window.Sortable) return;
  if (el._s) el._s.destroy();
  el._s = Sortable.create(el, {
    animation: 180, draggable: '.titem',
    ghostClass: 'sortable-ghost', chosenClass: 'sortable-chosen',
    onEnd() {
      const ids = [...el.querySelectorAll('.titem')].map(x => x.dataset.id);
      const ft  = getFiltered();
      const ro  = ids.map(id => ft.find(t => t.id === id)).filter(Boolean);
      const used = new Set(ro.map(t => t.id));
      tasks = [...ro, ...tasks.filter(t => !used.has(t.id))];
      save();
    }
  });
}

/* ══════════════════════════════════════
   STATS
══════════════════════════════════════ */
function updateStats() {
  const tot  = tasks.length;
  const done = tasks.filter(x => x.done).length;
  const pend = tasks.filter(x => !x.done).length;
  const sc   = tot ? Math.round(done/tot*100) : 0;
  document.getElementById('st-total').textContent = tot;
  document.getElementById('st-done').textContent  = done;
  document.getElementById('st-pend').textContent  = pend;
  document.getElementById('st-score').textContent = sc + '%';
  document.getElementById('sb-done').style.width  = (tot ? done/tot*100 : 0) + '%';
  document.getElementById('sb-pend').style.width  = (tot ? pend/tot*100 : 0) + '%';
  document.getElementById('sb-score').style.width = sc + '%';
}

/* ══════════════════════════════════════
   POMODORO
══════════════════════════════════════ */
function togglePomo() {
  if (pomoOn) {
    clearInterval(pomoTmr); pomoOn = false;
    document.getElementById('pomoBtn').textContent = 'Resume';
    if (inFocus) document.getElementById('fPomoBtn').textContent = 'Resume Timer';
  } else {
    pomoOn = true;
    document.getElementById('pomoBtn').textContent = 'Pause';
    if (inFocus) document.getElementById('fPomoBtn').textContent = 'Pause Timer';
    pomoTmr = setInterval(() => {
      pomoSec--; updPomo(); if (inFocus) updFocus();
      if (pomoSec <= 0) {
        clearInterval(pomoTmr); pomoOn = false;
        pomoCount++; localStorage.setItem('tf5_pomo', pomoCount);
        settings.pomos = (settings.pomos || 0) + 1; saveCfg(); syncDots();
        pomoSec = 25*60; updPomo();
        document.getElementById('pomoBtn').textContent = 'Start';
        if (inFocus) { updFocus(); document.getElementById('fPomoBtn').textContent = 'Start Timer'; }
        toast('Pomodoro complete! Take a break');
        document.getElementById('d-focus').textContent = settings.pomos || 0;
      }
    }, 1000);
  }
}
function resetPomo() {
  clearInterval(pomoTmr); pomoOn = false; pomoSec = 25*60; updPomo();
  document.getElementById('pomoBtn').textContent = 'Start';
  if (inFocus) { updFocus(); document.getElementById('fPomoBtn').textContent = 'Start Timer'; }
}
function updPomo() { document.getElementById('pomoDisplay').textContent = fmt(pomoSec); }
function syncDots() {
  const c = pomoCount % 4;
  for (let i = 0; i < 4; i++) {
    const d = document.getElementById('pd' + i);
    if (d) d.classList.toggle('on', i < c);
  }
}
function fmt(s) { return pad(Math.floor(s/60)) + ':' + pad(s%60); }
function pad(n) { return String(n).padStart(2,'0'); }

/* ══════════════════════════════════════
   FOCUS MODE
══════════════════════════════════════ */
function enterFocus() {
  const nxt = tasks.find(t => !t.done);
  document.getElementById('fTask').textContent = nxt ? nxt.title : 'All tasks complete!';
  updFocus(); openModal('focusOv'); inFocus = true;
}
function exitFocus()  { closeModal('focusOv'); inFocus = false; }
function updFocus()   {
  document.getElementById('fM').textContent = pad(Math.floor(pomoSec/60));
  document.getElementById('fS').textContent = pad(pomoSec%60);
}

/* ══════════════════════════════════════
   STREAK
══════════════════════════════════════ */
function renderStreak() {
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const ti   = (new Date().getDay() + 6) % 7;
  const td   = tasks.filter(t => t.completedAt && isToday(t.completedAt)).length;
  let streak = 0;
  for (let i = ti; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - (ti - i));
    if (tasks.filter(t => t.completedAt && isSame(t.completedAt, d)).length > 0) streak++;
    else break;
  }
  document.getElementById('streakRow').innerHTML = days.map((_,i) => {
    const d = new Date(); d.setDate(d.getDate() - (ti - i));
    const c = tasks.filter(t => t.completedAt && isSame(t.completedAt, d)).length;
    return `<div class="s-day ${c > 0 ? 'on' : ''}" title="${days[i]}"></div>`;
  }).join('');
  document.getElementById('streakN').textContent = streak;
  document.getElementById('todayN').textContent  = td;
  document.getElementById('streakSub').textContent =
    td > 0 ? `${td} task${td > 1 ? 's' : ''} completed today` : 'Complete a task to start your streak';
}
function isToday(iso) { return new Date(iso).toDateString() === new Date().toDateString(); }
function isSame(iso, d) { return new Date(iso).toDateString() === d.toDateString(); }

/* ══════════════════════════════════════
   DASHBOARD
══════════════════════════════════════ */
function renderDashboard() {
  const tot   = tasks.length;
  const done  = tasks.filter(x => x.done).length;
  const rate  = tot ? Math.round(done/tot*100) : 0;
  const today = tasks.filter(t => t.completedAt && isToday(t.completedAt)).length;
  document.getElementById('d-today').textContent = today;
  document.getElementById('d-rate').textContent  = rate + '%';
  document.getElementById('d-focus').textContent = settings.pomos || 0;
  document.getElementById('dg-txt').textContent  = `${today} / 5`;
  document.getElementById('wg-txt').textContent  = `${done} / 25`;
  document.getElementById('dg-bar').style.width  = Math.min(today/5*100, 100) + '%';
  document.getElementById('wg-bar').style.width  = Math.min(done/25*100, 100) + '%';
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const ti   = (new Date().getDay() + 6) % 7;
  const counts = days.map((_,i) => {
    const d = new Date(); d.setDate(d.getDate() - (ti - i));
    return tasks.filter(t => t.completedAt && isSame(t.completedAt, d)).length;
  });
  const mx = Math.max(...counts, 1);
  document.getElementById('chartBars').innerHTML =
    counts.map((c,i) => `<div class="cbar ${i===ti?'today':''}" style="height:${Math.max(c/mx*100,5)}%"></div>`).join('');
  document.getElementById('chartLabels').innerHTML =
    days.map(d => `<div class="clbl">${d}</div>`).join('');
  const cats = ['Work','Personal','Health','Learning'];
  const ttl  = tasks.length || 1;
  document.getElementById('catBreak').innerHTML = cats.map(c => {
    const n = tasks.filter(t => t.category === c).length;
    const p = Math.round(n/ttl*100);
    return `<div class="cat-row">
      <span class="cat-nm">${c}</span>
      <div class="cat-tr"><div class="cat-fi" style="width:${p}%"></div></div>
      <span class="cat-ct">${n}</span>
    </div>`;
  }).join('');
}

/* ══════════════════════════════════════
   INSIGHTS
══════════════════════════════════════ */
function renderInsights() {
  const tot  = tasks.length;
  const done = tasks.filter(x => x.done).length;
  const high = tasks.filter(x => x.done && x.priority === 'high').length;
  const od   = tasks.filter(x => x.due && !x.done && new Date(x.due) < new Date()).length;
  const fc   = settings.pomos || 0;
  document.getElementById('metricsEl').innerHTML = [
    { l: 'Total Tasks Created', v: tot,  p: 100 },
    { l: 'Completion Rate',     v: (tot ? Math.round(done/tot*100) : 0) + '%', p: tot ? done/tot*100 : 0 },
    { l: 'High Priority Done',  v: high, p: tot ? high/tot*100 : 0 },
    { l: 'Overdue Tasks',       v: od,   p: tot ? od/tot*100 : 0 },
    { l: 'Focus Sessions',      v: fc,   p: Math.min(fc/10*100, 100) },
  ].map(m =>
    `<div class="m-row">
      <span class="m-lb">${m.l}</span>
      <div class="m-tr"><div class="m-fi" style="width:${m.p}%"></div></div>
      <span class="m-vl">${m.v}</span>
    </div>`
  ).join('');
  const logEl = document.getElementById('logEl');
  if (!activity.length) {
    logEl.innerHTML = '<div style="font-size:12px;color:var(--t3);padding:10px 0">No activity yet.</div>';
    return;
  }
  logEl.innerHTML = [...activity].reverse().slice(0,30).map(a =>
    `<div class="log-item">
      <div class="log-t">${a.time}</div>
      <div class="log-m">${esc(a.msg)}</div>
    </div>`
  ).join('');
}

/* ══════════════════════════════════════
   ACHIEVEMENTS
══════════════════════════════════════ */
const ACHS = [
  { e:'🎯', n:'First Task',    d:'Create your first task',        c: () => tasks.length >= 1 },
  { e:'✅', n:'Task Master',   d:'Complete 10 tasks',             c: () => tasks.filter(x=>x.done).length >= 10 },
  { e:'🔴', n:'High Focus',    d:'Complete 5 high-priority tasks', c: () => tasks.filter(x=>x.done&&x.priority==='high').length >= 5 },
  { e:'⏱',  n:'Pomodoro Pro',  d:'Complete 5 focus sessions',     c: () => (settings.pomos||0) >= 5 },
  { e:'📋', n:'Planner',       d:'Create 25 tasks',               c: () => tasks.length >= 25 },
  { e:'🏃', n:'Sprint',        d:'Complete 3 tasks today',        c: () => tasks.filter(t=>t.completedAt&&isToday(t.completedAt)).length >= 3 },
  { e:'📂', n:'Organizer',     d:'Use all 4 categories',          c: () => ['Work','Personal','Health','Learning'].every(c=>tasks.some(t=>t.category===c)) },
  { e:'📝', n:'Note Taker',    d:'Add notes to 5 tasks',          c: () => tasks.filter(x=>x.notes&&x.notes.trim()).length >= 5 },
  { e:'🤖', n:'AI User',       d:'Use the AI assistant once',     c: () => (settings.aiUsed||0) >= 1 },
];
function renderAchievements() {
  document.getElementById('achGrid').innerHTML = ACHS.map(a => {
    const e = a.c();
    return `<div class="ac ${e ? 'earned' : 'locked'}">
      <div class="ae">${a.e}</div>
      <div class="an">${a.n}</div>
      <div class="ad">${a.d}</div>
      ${e ? '<span class="ab-b">Earned</span>' : ''}
    </div>`;
  }).join('');
}

/* ══════════════════════════════════════
   AI ASSISTANT
══════════════════════════════════════ */
async function sendAI() {
  const inp = document.getElementById('aiInput');
  const msg = inp.value.trim(); if (!msg) return;
  inp.value = '';
  const msgs = document.getElementById('aiMsgs');
  msgs.innerHTML += `<div class="msg usr">${esc(msg)}</div>`;
  msgs.innerHTML += `<div class="typing-row" id="aiTyping"><span></span><span></span><span></span></div>`;
  msgs.scrollTop = msgs.scrollHeight;
  settings.aiUsed = (settings.aiUsed || 0) + 1; saveCfg();
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', max_tokens: 1000,
        system: `You are TaskFlow AI, a premium productivity assistant built by Anish Wani (Anish Inspires).
Help users break goals into actionable numbered tasks. Always format tasks as:
1. Task name
2. Task name
Keep responses under 200 words. Be direct and motivating.`,
        messages: [{ role: 'user', content: msg }]
      })
    });
    const data = await res.json();
    const typing = document.getElementById('aiTyping'); if (typing) typing.remove();
    const reply  = data.content?.[0]?.text || 'Something went wrong. Try again.';
    msgs.innerHTML += `<div class="msg bot">${reply.replace(/\n/g,'<br>')}</div>`;
    const lines = reply.match(/^\d+\.\s+.+/mg);
    if (lines && lines.length >= 2) {
      const titles = lines.map(l => l.replace(/^\d+\.\s+/, '').trim());
      msgs.innerHTML += `<div class="msg add" onclick='addAITasks(${JSON.stringify(titles)})'>+ Add ${titles.length} tasks to your list</div>`;
    }
    msgs.scrollTop = msgs.scrollHeight;
    log('AI: ' + msg.slice(0,50));
  } catch(e) {
    const t = document.getElementById('aiTyping'); if (t) t.remove();
    msgs.innerHTML += `<div class="msg bot">Network error. Check connection and try again.</div>`;
    msgs.scrollTop = msgs.scrollHeight;
  }
}
function addAITasks(titles) {
  titles.forEach(t => tasks.unshift({
    id: uid(), title: t, priority: 'medium', category: 'Learning',
    done: false, created: new Date().toISOString(), subtasks: []
  }));
  save(); renderTasks(); updateStats();
  toast(`${titles.length} AI tasks added`);
}

/* ══════════════════════════════════════
   THEME
══════════════════════════════════════ */
function toggleTheme() {
  document.body.classList.toggle('light');
  settings.theme = document.body.classList.contains('light') ? 'light' : 'dark';
  saveCfg(); toast(settings.theme === 'light' ? 'Light mode' : 'Dark mode');
}

/* ══════════════════════════════════════
   LOG & TOAST
══════════════════════════════════════ */
function log(msg) {
  activity.push({ msg, time: new Date().toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) });
  if (activity.length > 100) activity.shift();
  localStorage.setItem('tf5_log', JSON.stringify(activity));
}
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<div class="td"></div>${esc(msg)}`;
  document.getElementById('toastWrap').appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
  setTimeout(() => { el.classList.remove('on'); setTimeout(() => el.remove(), 400); }, 2800);
}

/* ══════════════════════════════════════
   KEYBOARD SHORTCUTS
══════════════════════════════════════ */
document.addEventListener('keydown', e => {
  const tp = document.activeElement.tagName === 'INPUT'
          || document.activeElement.tagName === 'TEXTAREA';
  if (e.key === 'Escape') { closeModal('taskModal'); closeModal('aboutModal'); exitFocus(); }
  if (!tp) {
    if (e.key === 'f' || e.key === 'F') enterFocus();
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openTaskModal(); }
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); document.getElementById('searchInput').focus(); }
});

/* ══════════════════════════════════════
   PERSIST & UTILS
══════════════════════════════════════ */
function save()    { localStorage.setItem('tf5_tasks', JSON.stringify(tasks)); }
function saveCfg() { localStorage.setItem('tf5_cfg',   JSON.stringify(settings)); }
function uid()     { return Date.now() + '_' + Math.random().toString(36).slice(2,8); }
function esc(s)    { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
