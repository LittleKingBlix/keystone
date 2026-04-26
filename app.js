// ============================================================
// Keystone, main app
// State, persistence, view routing, today rendering, month rendering
// ============================================================

const STORAGE_KEY = 'keystone.state.v1';

const HABITS = [
  { key: 'read',          label: 'Read 10 pages',     type: 'check' },
  { key: 'weighIn',       label: 'Weigh in',          type: 'weight' },
  { key: 'water',         label: '64oz water',        type: 'check' },
  { key: 'workout',       label: '45 min workout',    type: 'check' },
  { key: 'diet',          label: 'Compliant meal',    type: 'check' },
  { key: 'visualization', label: 'Visualization',     type: 'check' },
  { key: 'social',        label: 'Social food only',  type: 'check' },
  { key: 'coldShower',    label: 'Cold shower',       type: 'check' },
];

// ---------- State ----------

function defaultState() {
  const now = new Date();
  if (now.getHours() < 4) now.setDate(now.getDate() - 1);
  return {
    appName: 'Keystone',
    startDate: window.Keystone.formatDateKey(now),
    dayBoundaryHour: 4,
    days: {},
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch (e) {
    console.error('Failed to load state, resetting', e);
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

// ---------- Today view ----------

function todayKey() {
  return window.Keystone.todayKeyFor(state);
}

function renderToday() {
  const tk = todayKey();
  const day = state.days[tk] || {};
  const date = window.Keystone.parseDateKey(tk);

  document.getElementById('today-day').textContent =
    date.toLocaleDateString('en-US', { weekday: 'long' });
  document.getElementById('today-date').textContent =
    date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  const streak = window.Keystone.computeCurrentStreak(state, tk);
  document.getElementById('streak-number').textContent = streak;

  const list = document.getElementById('habits-list');
  list.innerHTML = '';
  HABITS.forEach(h => {
    const li = document.createElement('li');
    li.className = 'habit';
    const isDone =
      h.type === 'weight' ? !!(day[h.key] && day[h.key].done) : !!day[h.key];
    if (isDone) li.classList.add('done');

    const cb = document.createElement('div');
    cb.className = 'habit-checkbox';
    li.appendChild(cb);

    const label = document.createElement('div');
    label.className = 'habit-label';
    label.textContent = h.label;
    li.appendChild(label);

    if (h.type === 'weight') {
      const input = document.createElement('input');
      input.className = 'habit-input';
      input.type = 'number';
      input.inputMode = 'decimal';
      input.step = '0.1';
      input.placeholder = '---';
      input.value = day[h.key]?.value ?? '';
      input.addEventListener('click', e => e.stopPropagation());
      input.addEventListener('change', e => {
        const v = parseFloat(e.target.value);
        if (isNaN(v)) {
          setHabit(tk, h.key, { done: false });
        } else {
          setHabit(tk, h.key, { done: true, value: v });
        }
      });
      li.appendChild(input);

      li.addEventListener('click', e => {
        if (e.target === input) return;
        const cur = day[h.key];
        if (cur?.done) {
          setHabit(tk, h.key, { done: false, value: cur.value ?? null });
        } else if (cur?.value != null) {
          setHabit(tk, h.key, { done: true, value: cur.value });
        } else {
          input.focus();
        }
      });
    } else {
      li.addEventListener('click', () => {
        setHabit(tk, h.key, !day[h.key]);
      });
    }

    list.appendChild(li);
  });
}

function setHabit(dateKey, habitKey, value) {
  if (!state.days[dateKey]) state.days[dateKey] = {};
  state.days[dateKey][habitKey] = value;
  saveState();
  renderToday();
}

// ---------- Month view ----------

let monthCursor = new Date();

function renderMonth() {
  const y = monthCursor.getFullYear();
  const m = monthCursor.getMonth();
  document.getElementById('month-title').textContent =
    monthCursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const firstDay = new Date(y, m, 1);
  const startCellDate = new Date(firstDay);
  startCellDate.setDate(1 - firstDay.getDay());

  const grid = document.getElementById('month-grid');
  grid.innerHTML = '';

  const tk = todayKey();

  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(startCellDate);
    cellDate.setDate(startCellDate.getDate() + i);
    const k = window.Keystone.formatDateKey(cellDate);

    const cell = document.createElement('div');
    cell.className = 'day-cell';
    if (cellDate.getMonth() !== m) cell.classList.add('outside-month');
    if (k === tk) cell.classList.add('today');

    const num = document.createElement('span');
    num.className = 'day-num';
    num.textContent = cellDate.getDate();
    cell.appendChild(num);

    const day = state.days[k];
    if (day) {
      const completed = HABITS.filter(h => {
        const v = day[h.key];
        if (h.type === 'weight') return v?.done;
        return !!v;
      }).length;
      if (completed === HABITS.length) cell.classList.add('compliant');
      else if (completed > 0) cell.classList.add('partial');
    }

    cell.addEventListener('click', () => openDayDetail(k));
    grid.appendChild(cell);
  }
}

function openDayDetail(dateKeyStr) {
  const day = state.days[dateKeyStr] || {};
  const date = window.Keystone.parseDateKey(dateKeyStr);
  const overlay = document.createElement('div');
  overlay.className = 'day-detail';

  const card = document.createElement('div');
  card.className = 'day-detail-card';

  const h3 = document.createElement('h3');
  h3.textContent = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  card.appendChild(h3);

  const ul = document.createElement('ul');
  ul.className = 'day-detail-list';
  HABITS.forEach(h => {
    const li = document.createElement('li');
    const mark = document.createElement('span');
    mark.className = 'check-mark';
    const done =
      h.type === 'weight' ? !!(day[h.key] && day[h.key].done) : !!day[h.key];
    mark.classList.add(done ? 'done' : 'miss');
    mark.textContent = done ? 'X' : '.';
    li.appendChild(mark);

    const lbl = document.createElement('span');
    lbl.textContent = h.label;
    if (h.type === 'weight' && day[h.key]?.value != null) {
      lbl.textContent += `  (${day[h.key].value})`;
    }
    li.appendChild(lbl);
    ul.appendChild(li);
  });
  card.appendChild(ul);

  const close = document.createElement('button');
  close.className = 'day-detail-close';
  close.textContent = 'Close';
  close.addEventListener('click', () => overlay.remove());
  card.appendChild(close);

  overlay.appendChild(card);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

document.getElementById('prev-month').addEventListener('click', () => {
  monthCursor.setMonth(monthCursor.getMonth() - 1);
  renderMonth();
});
document.getElementById('next-month').addEventListener('click', () => {
  monthCursor.setMonth(monthCursor.getMonth() + 1);
  renderMonth();
});

// ---------- Settings view ----------

function renderSettings() {
  document.getElementById('start-date').value = state.startDate;
  document.getElementById('day-boundary').value = String(state.dayBoundaryHour);

  const rulesEl = document.getElementById('rules-display');
  fetch('rules.md')
    .then(r => (r.ok ? r.text() : Promise.reject('not found')))
    .then(text => { rulesEl.textContent = text; })
    .catch(() => {
      rulesEl.textContent =
        'rules.md not loaded. (Open via http://localhost or after deploy. Edit the file in the project folder.)';
    });
}

document.getElementById('start-date').addEventListener('change', e => {
  state.startDate = e.target.value;
  saveState();
  renderToday();
});

document.getElementById('day-boundary').addEventListener('change', e => {
  state.dayBoundaryHour = parseInt(e.target.value, 10);
  saveState();
  renderToday();
});

document.getElementById('export-data').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `keystone-${todayKey()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('import-data').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        state = { ...defaultState(), ...imported };
        saveState();
        renderToday();
        renderMonth();
        renderSettings();
        alert('Data imported.');
      } catch (err) {
        alert('Invalid file.');
      }
    };
    reader.readAsText(file);
  });
  input.click();
});

document.getElementById('reset-program').addEventListener('click', () => {
  if (!confirm('Reset program? This wipes all day records and starts over today.')) return;
  if (!confirm('Are you sure? This cannot be undone.')) return;
  state = defaultState();
  saveState();
  renderToday();
  renderMonth();
  renderSettings();
});

// ---------- Tab routing ----------

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === btn));
    document.querySelectorAll('.view').forEach(v => {
      v.classList.toggle('active', v.id === `view-${view}`);
    });
    if (view === 'today') renderToday();
    if (view === 'month') renderMonth();
    if (view === 'settings') renderSettings();
  });
});

document.getElementById('open-rules').addEventListener('click', e => {
  e.preventDefault();
  document.querySelector('.tab[data-view="settings"]').click();
});

// ---------- Initial render ----------

renderToday();
