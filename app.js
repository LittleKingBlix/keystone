// Keystone, Direction F, vanilla-JS port of the Claude Design handoff.
// State + persistence + view rendering + tap-to-toggle + sheets.

(function () {
  const K = window.Keystone;
  const HABITS = K.HABITS;

  const STORAGE_KEY = 'keystone:v1';
  const LEGACY_KEY = 'keystone.state.v1';

  // ---------- State ----------

  function defaultState() {
    return {
      records: [],
      startDate: K.todayString(new Date(), 4),
      dayBoundaryHour: 4,
    };
  }

  // Migrate legacy schema (days object, weighIn special shape, old habit IDs).
  // Old: { startDate, dayBoundaryHour, days: { date: { read, weighIn:{done,value}, water, workout, diet, visualization, social, coldShower } } }
  // New: { startDate, dayBoundaryHour, records: [{ date, habits:{ read, weigh, water, workout, meal, visualize, social, cold }, weight }] }
  function migrateLegacy(legacy) {
    const map = {
      read: 'read',
      weighIn: 'weigh',
      water: 'water',
      workout: 'workout',
      diet: 'meal',
      visualization: 'visualize',
      social: 'social',
      coldShower: 'cold',
    };
    const records = [];
    const days = legacy.days || {};
    for (const [date, day] of Object.entries(days)) {
      const habits = {};
      let weight = null;
      for (const [oldId, newId] of Object.entries(map)) {
        const v = day[oldId];
        if (oldId === 'weighIn') {
          habits[newId] = !!(v && v.done);
          if (v && typeof v.value === 'number') weight = v.value;
        } else {
          habits[newId] = !!v;
        }
      }
      records.push({ date, habits, weight });
    }
    records.sort((a, b) => a.date.localeCompare(b.date));
    return {
      records,
      startDate: legacy.startDate || K.todayString(new Date(), 4),
      dayBoundaryHour: legacy.dayBoundaryHour ?? 4,
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.records && s.startDate) {
          return { ...defaultState(), ...s };
        }
      }
      // Try legacy migration
      const legacyRaw = localStorage.getItem(LEGACY_KEY);
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw);
        if (legacy && legacy.days) {
          const migrated = migrateLegacy(legacy);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          return migrated;
        }
      }
    } catch (e) {
      console.warn('loadState failed:', e);
    }
    return defaultState();
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  let state = loadState();
  let activeTab = 'today';
  let monthCursor = K.parseISO(K.todayString(new Date(), state.dayBoundaryHour));

  // ---------- Helpers ----------

  function todayKey() {
    return K.todayString(new Date(), state.dayBoundaryHour);
  }

  function upsertRecord(rec) {
    const without = state.records.filter(r => r.date !== rec.date);
    state.records = [...without, rec].sort((a, b) => a.date.localeCompare(b.date));
    saveState();
  }

  function toggleHabitOn(date, habitId) {
    const rec = K.recordFor(state.records, date) || { date, habits: {}, weight: null };
    rec.habits = { ...rec.habits, [habitId]: !rec.habits[habitId] };
    upsertRecord(rec);
  }

  function setWeight(date, value) {
    const rec = K.recordFor(state.records, date) || { date, habits: {}, weight: null };
    rec.weight = value;
    rec.habits = { ...rec.habits, weigh: value != null && !isNaN(value) };
    upsertRecord(rec);
  }

  // ---------- Today view ----------

  function renderToday() {
    const today = todayKey();
    const rec = K.recordFor(state.records, today) || { date: today, habits: {}, weight: null };
    const dt = K.parseISO(today);
    const dow = dt.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    const mon = dt.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const day = dt.getDate();
    const yr = String(dt.getFullYear()).slice(2);
    const { streak } = K.computeStreak(state.records, state.startDate, today);
    const done = HABITS.reduce((n, h) => n + (rec.habits[h.id] ? 1 : 0), 0);

    const view = document.getElementById('view-today');
    view.innerHTML = `
      <div class="masthead">
        <div class="masthead-overline">
          <span>${dow}</span>
          <span class="rule"></span>
          <span class="streak-no">NO. ${String(streak).padStart(3, '0')}</span>
        </div>
        <div class="masthead-display">
          <div class="mon">${mon}</div>
          <div class="day">${day}</div>
        </div>
        <div class="masthead-year">'${yr}</div>
      </div>
      <ul class="habits">
        ${HABITS.map((h, i) => {
          const isDone = !!rec.habits[h.id];
          return `
            <li class="habit ${isDone ? 'done' : ''}" data-habit="${h.id}">
              <div class="habit-wash"></div>
              <div class="habit-num"><span>${i + 1}</span></div>
              <div class="habit-label">${h.label}</div>
              ${h.id === 'weigh' ? `<input class="habit-input" type="number" inputmode="decimal" step="0.1" placeholder="—" value="${rec.weight ?? ''}"/>` : ''}
              <div class="habit-dot"></div>
            </li>
          `;
        }).join('')}
      </ul>
      <div class="color-check">
        ${Array.from({ length: 8 }, (_, i) => `<div class="seg ${i < done ? 'on' : ''}"></div>`).join('')}
      </div>
    `;

    // Wire up drag-to-commit on each row.
    // Rule (matches the design):
    //   - Committed row + tap (pointerdown) = un-commit (toggle off)
    //   - Uncommitted row + drag past 55% width = commit
    //   - Uncommitted row + tap with no drag = nothing (forces deliberate gesture)
    view.querySelectorAll('.habit').forEach(li => attachDragRow(li, today));

    // Weigh-in input gets its own change handler.
    const winp = view.querySelector('.habit-input');
    if (winp) {
      winp.addEventListener('change', e => {
        const v = parseFloat(e.target.value);
        setWeight(today, isNaN(v) ? null : v);
        renderToday();
      });
    }
  }

  // Drag-to-commit handler for a single habit row.
  // Ports keystone-shared.jsx::useDragComplete to vanilla JS.
  function attachDragRow(li, date) {
    const id = li.dataset.habit;
    const wash = li.querySelector('.habit-wash');
    let startX = null;
    let width = 0;
    let drag = 0;

    const setVisual = (v) => {
      drag = v;
      if (wash) wash.style.clipPath = `inset(0 ${(1 - v) * 100}% 0 0)`;
    };

    const onPointerDown = (e) => {
      // Don't hijack the weight input.
      if (e.target.classList && e.target.classList.contains('habit-input')) return;

      const isDone = li.classList.contains('done');
      if (isDone) {
        // Tap to undo on a committed row.
        e.preventDefault();
        if (id === 'weigh') {
          // Keep the recorded weight value, just mark weigh as not done.
          const r = K.recordFor(state.records, date) || { date, habits: {}, weight: null };
          r.habits = { ...r.habits, weigh: false };
          upsertRecord(r);
        } else {
          toggleHabitOn(date, id);
        }
        renderToday();
        return;
      }

      // Begin drag tracking. Use currentTarget (the row), not e.target (might be a child).
      const rect = li.getBoundingClientRect();
      startX = e.clientX;
      width = rect.width || 1;
      li.classList.add('dragging');
      try { li.setPointerCapture(e.pointerId); } catch (_) {}
    };

    const onPointerMove = (e) => {
      if (startX == null) return;
      const dx = e.clientX - startX;
      setVisual(Math.max(0, Math.min(1, dx / width)));
    };

    const onPointerUp = (e) => {
      if (startX == null) return;
      li.classList.remove('dragging');
      const finalDrag = drag; // live value, not stale
      startX = null;
      try { li.releasePointerCapture(e.pointerId); } catch (_) {}
      if (finalDrag >= 0.55) {
        // Commit
        setVisual(1);
        if (id === 'weigh') {
          const cur = K.recordFor(state.records, date)?.weight;
          if (cur != null) {
            setWeight(date, cur);
          } else {
            // No weight value yet: focus the input so they can type one,
            // but don't mark weigh as done until a value is recorded.
            const input = li.querySelector('.habit-input');
            setVisual(0);
            if (input) input.focus();
            return;
          }
        } else {
          toggleHabitOn(date, id);
        }
        renderToday();
      } else {
        // Snap back
        setVisual(0);
      }
    };

    const onPointerCancel = () => {
      startX = null;
      li.classList.remove('dragging');
      setVisual(li.classList.contains('done') ? 1 : 0);
    };

    li.addEventListener('pointerdown', onPointerDown);
    li.addEventListener('pointermove', onPointerMove);
    li.addEventListener('pointerup', onPointerUp);
    li.addEventListener('pointercancel', onPointerCancel);
  }

  // ---------- Month view ----------

  function renderMonth() {
    const today = todayKey();
    const dt = monthCursor;
    const cells = K.monthGrid(dt.getFullYear(), dt.getMonth(), state.records, state.startDate, today, 0);
    const monthLabel = dt.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const yr = String(dt.getFullYear()).slice(2);
    const monthCells = cells.filter(c => c.inMonth && !c.future && !c.beforeStart);
    const compliant = monthCells.filter(c => c.complete).length;

    const view = document.getElementById('view-month');
    view.innerHTML = `
      <div class="month-masthead">
        <div class="section-overline">VOL. 01 — ISSUE ${dt.getMonth() + 1}</div>
        <div class="month-display">
          <div class="mon-label">${monthLabel}</div>
          <div class="red-bar"></div>
          <div class="yr">'${yr}</div>
        </div>
        <div class="month-nav-row">
          <button class="month-nav" id="prev-month" aria-label="Previous month">←</button>
          <button class="month-nav" id="next-month" aria-label="Next month">→</button>
        </div>
      </div>
      <div class="weekday-row">
        ${['S','M','T','W','T','F','S'].map((d, i) => `<div class="wd ${(i === 0 || i === 6) ? 'weekend' : ''}">${d}</div>`).join('')}
      </div>
      <div class="month-grid">
        ${cells.map((c, i) => renderCell(c)).join('')}
      </div>
      <div class="month-bottom">
        <span>KEPT</span>
        <span class="kept-num">${String(compliant).padStart(2, '0')}</span>
        <span>OF ${String(monthCells.length).padStart(2, '0')}</span>
      </div>
    `;

    document.getElementById('prev-month').addEventListener('click', () => {
      monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1);
      renderMonth();
    });
    document.getElementById('next-month').addEventListener('click', () => {
      monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1);
      renderMonth();
    });

    view.querySelectorAll('.day-cell').forEach(btn => {
      const date = btn.dataset.date;
      btn.addEventListener('click', () => {
        const c = cells.find(x => x.date === date);
        if (!c || !c.inMonth || c.future || c.beforeStart) return;
        openDayPeek(date);
      });
    });
  }

  function renderCell(c) {
    const classes = ['day-cell'];
    if (!c.inMonth) classes.push('outside-month');
    if (c.future) classes.push('future');
    if (c.beforeStart) classes.push('before-start');
    // Today is never shown as "complete" in the calendar, even if all 8 are
    // done. The day is still in progress; the day rolls over to "complete" the
    // next morning. This preserves the meaning of an ink-filled cell as
    // "this day was kept" (past tense).
    const showComplete = c.complete && !c.isToday;
    if (showComplete) classes.push('complete');
    if (c.isToday) classes.push('today-cell');

    let inner = `<span class="day-num">${c.day}</span>`;

    // Progress bars: shown on today always (so 0/8 reads as "started, no
    // progress yet" and 8/8 reads as "all done, but day not closed"), and on
    // past partial days. Never on a fully-complete past day (its cell is
    // ink-filled instead).
    const showBars = c.inMonth && !c.future && !c.beforeStart && (
      c.isToday || (!c.complete && c.count > 0)
    );
    if (showBars) {
      inner += `<span class="day-bars">${
        Array.from({ length: 8 }, (_, j) => `<span class="bar ${j < c.count ? 'on' : ''}"></span>`).join('')
      }</span>`;
    }

    // Diagonal slash for "no progress at all" days, ONLY on past days.
    // Today with 0/8 is in progress, not missed.
    const showSlash = c.count === 0 && c.inMonth && !c.future && !c.beforeStart && !c.isToday;
    if (showSlash) {
      inner += `<svg class="day-slash" preserveAspectRatio="none" viewBox="0 0 40 40"><line x1="6" y1="34" x2="34" y2="6" stroke="${getCSSVar('--blue')}" stroke-width="2.5" stroke-linecap="round"/></svg>`;
    }

    return `<button class="${classes.join(' ')}" data-date="${c.date}">${inner}</button>`;
  }

  function getCSSVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#2a4ec4';
  }

  // ---------- History view ----------

  function renderHistory() {
    const today = todayKey();
    const breaks = K.computeBreaks(state.records, state.startDate, today);
    const totalDays = Math.max(0, K.daysBetween(state.startDate, today));
    const { streak, completedDays } = K.computeStreak(state.records, state.startDate, today);
    const compliance = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;
    const habitMap = Object.fromEntries(HABITS.map(h => [h.id, h]));

    const view = document.getElementById('view-history');
    view.innerHTML = `
      <div class="section-masthead">
        <div class="section-overline">SECTION 04</div>
        <div class="section-headline">HIS<span class="dot">·</span>TORY</div>
      </div>
      <div class="stat-row">
        <div class="stat accent">
          <div class="n">${breaks.length}</div>
          <div class="lbl">BREAKS</div>
        </div>
        <div class="stat">
          <div class="n">${completedDays}</div>
          <div class="lbl">PERFECT DAYS</div>
        </div>
        <div class="stat small">
          <div class="n">${compliance}%</div>
          <div class="lbl">COMPLIANCE</div>
        </div>
      </div>
      <div class="current-chain">
        <span class="lbl">CURRENT CHAIN</span>
        <span class="day-n">DAY ${streak}</span>
      </div>
      <div class="break-list">
        ${breaks.length === 0 ? `
          <div class="empty-history">
            THE CHAIN<br>
            <span class="red">HAS NOT</span><br>
            BROKEN.
            <div class="sub">KEEP IT THAT WAY.</div>
          </div>
        ` : `
          <div class="breaks-overline">EVERY TIME THE CHAIN BROKE</div>
          ${breaks.slice().reverse().map(b => {
            const dt = K.parseISO(b.date);
            const md = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
            const yr = dt.getFullYear();
            const habitLabel = (habitMap[b.missedHabit]?.label || b.missedHabit).toUpperCase();
            return `
              <div class="break-row">
                <div class="date">${md}</div>
                <div>
                  <div class="habit">${habitLabel}</div>
                  <div class="sub">MISSED TWO DAYS RUNNING</div>
                </div>
                <div class="meta">
                  ${yr}<br>
                  <span class="lost">−${b.runLength}d</span>
                </div>
              </div>
            `;
          }).join('')}
          <div class="ledger-callout">
            <div class="tag">// THE LEDGER</div>
            Every break is a lesson, not a verdict. The chain is not the point. The work is.
          </div>
        `}
      </div>
    `;
  }

  // ---------- Settings view ----------

  function renderSettings() {
    const startedDt = K.parseISO(state.startDate);
    const startedLabel = startedDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
    const dayEnds = `${String(state.dayBoundaryHour).padStart(2, '0')}:00`;

    const view = document.getElementById('view-settings');
    view.innerHTML = `
      <div class="section-masthead">
        <div class="section-overline">SECTION</div>
        <div class="section-headline">SET<span class="dot">·</span>TINGS</div>
      </div>
      <div class="settings-list">
        <button class="settings-item" data-action="started">
          <span class="label">STARTED</span>
          <span class="value">${startedLabel}</span>
        </button>
        <button class="settings-item" data-action="day-ends">
          <span class="label">DAY ENDS</span>
          <span class="value">${dayEnds}</span>
        </button>
        <button class="settings-item" data-action="export">
          <span class="label">EXPORT</span>
          <span class="value">JSON ›</span>
        </button>
        <button class="settings-item" data-action="import">
          <span class="label">IMPORT</span>
          <span class="value">… ›</span>
        </button>
        <button class="settings-item" data-action="rules">
          <span class="label">THE RULES</span>
          <span class="value">READ ›</span>
        </button>
        <button class="settings-item" data-action="definitions">
          <span class="label">DEFINITIONS</span>
          <span class="value">RULES.MD ›</span>
        </button>
        <button class="settings-item danger" data-action="reset">
          <span class="label">RESET CHAIN</span>
          <span class="value">›</span>
        </button>
      </div>
      <div class="rule-callout">
        <div class="tag">THE RULE</div>
        <div class="body">SAME HABIT MISSED TWO DAYS RUNNING, CHAIN BREAKS. ONE SLIP IS HUMAN. TWO IS A HABIT.</div>
      </div>
      <div class="settings-footer">KEYSTONE — VOL. 01</div>
    `;

    view.querySelectorAll('.settings-item').forEach(btn => {
      btn.addEventListener('click', () => onSettingsAction(btn.dataset.action));
    });
  }

  function onSettingsAction(action) {
    if (action === 'started') {
      const next = prompt('Start date (YYYY-MM-DD):', state.startDate);
      if (next && /^\d{4}-\d{2}-\d{2}$/.test(next)) {
        state.startDate = next;
        saveState();
        renderActive();
      }
    } else if (action === 'day-ends') {
      const next = prompt('Day cutoff hour (0 for midnight, 4 for forgiving):', String(state.dayBoundaryHour));
      const h = parseInt(next, 10);
      if (!isNaN(h) && h >= 0 && h <= 23) {
        state.dayBoundaryHour = h;
        saveState();
        renderActive();
      }
    } else if (action === 'export') {
      exportJSON();
    } else if (action === 'import') {
      importJSON();
    } else if (action === 'rules') {
      openRulesSheet();
    } else if (action === 'definitions') {
      window.open('rules.md', '_blank');
    } else if (action === 'reset') {
      openResetConfirm();
    }
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keystone-${todayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function importJSON() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'application/json';
    inp.onchange = () => {
      const f = inp.files?.[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const parsed = JSON.parse(r.result);
          if (parsed.records && parsed.startDate) {
            state = { ...defaultState(), ...parsed };
            saveState();
            renderActive();
          } else if (parsed.days) {
            // Legacy format
            const migrated = migrateLegacy(parsed);
            state = migrated;
            saveState();
            renderActive();
          } else {
            alert('Not a Keystone export.');
          }
        } catch (e) {
          alert('Could not parse file.');
        }
      };
      r.readAsText(f);
    };
    inp.click();
  }

  // ---------- Sheets / modals ----------

  function openRulesSheet() {
    const lines = [
      ['1', 'EIGHT THINGS. EVERY DAY.'],
      ['2', 'A DAY IS COMPLETE OR IT IS NOT.'],
      ['3', 'YESTERDAY IS DONE. WRITE IT IN INK.'],
      ['4', 'MISS THE SAME THING TWICE'],
      ['5', 'AND THE CHAIN BREAKS.'],
      ['6', 'TODAY IS NEVER A MISS.'],
      ['7', 'THE WORK IS THE REWARD.'],
      ['8', 'BEGIN AGAIN. BEGIN NOW.'],
    ];
    const overlay = document.createElement('div');
    overlay.className = 'sheet-overlay';
    overlay.innerHTML = `
      <div class="sheet-card">
        <div class="sheet-header">
          <span>THE RULES</span>
          <button class="sheet-close">×</button>
        </div>
        <div class="rules-body">
          ${lines.map(([n, t]) => `
            <div class="rule-line">
              <span class="num">${n}</span>
              <span class="text">${t}</span>
            </div>
          `).join('')}
          <div class="rules-streak-callout">
            <div class="tag">// THE STREAK RULE</div>
            If the same habit is missed two days in a row, the chain resets.
            Different habits missed on consecutive days are forgiven. Today is
            in progress and never counts against you.
          </div>
        </div>
      </div>
    `;
    overlay.addEventListener('click', e => {
      if (e.target === overlay || e.target.classList.contains('sheet-close')) {
        overlay.remove();
      }
    });
    document.body.appendChild(overlay);
  }

  function openResetConfirm() {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-card">
        <div class="confirm-header">RESET CHAIN</div>
        <div class="confirm-title">ERASE EVERY DAY AND BEGIN AGAIN.</div>
        <div class="confirm-body">Your records are deleted. There is no undo. The new chain starts today.</div>
        <div class="confirm-actions">
          <button class="confirm-btn cancel">CANCEL</button>
          <button class="confirm-btn confirm">RESET</button>
        </div>
      </div>
    `;
    overlay.querySelector('.cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('.confirm').addEventListener('click', () => {
      state = { records: [], startDate: todayKey(), dayBoundaryHour: state.dayBoundaryHour };
      saveState();
      renderActive();
      overlay.remove();
    });
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  function openDayPeek(date) {
    const today = todayKey();
    const rec = K.recordFor(state.records, date) || { date, habits: {}, weight: null };
    const dt = K.parseISO(date);
    const md = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
    const isToday = date === today;
    const isFuture = K.daysBetween(today, date) > 0;

    const overlay = document.createElement('div');
    overlay.className = 'sheet-overlay';
    overlay.innerHTML = `
      <div class="sheet-card">
        <div class="sheet-header">
          <span>${md}${isToday ? '<span class="peek-today-tag">TODAY</span>' : ''}</span>
          <button class="sheet-close">×</button>
        </div>
        <div class="peek-list">
          ${HABITS.map((h, i) => {
            const done = !!rec.habits[h.id];
            return `
              <button class="peek-item ${done ? 'done' : ''} ${isFuture ? 'disabled' : ''}" data-habit="${h.id}" ${isFuture ? 'disabled' : ''}>
                <span class="num">${i + 1}</span>
                <span class="lbl">${h.label}</span>
                <span class="check"></span>
              </button>
            `;
          }).join('')}
        </div>
        ${isFuture ? '<div class="peek-future-note">— NOT YET —</div>' : ''}
      </div>
    `;

    overlay.addEventListener('click', e => {
      if (e.target === overlay || e.target.classList.contains('sheet-close')) {
        overlay.remove();
      }
    });

    overlay.querySelectorAll('.peek-item').forEach(btn => {
      const id = btn.dataset.habit;
      btn.addEventListener('click', () => {
        if (isFuture) return;
        toggleHabitOn(date, id);
        // Re-render the peek with fresh state
        overlay.remove();
        openDayPeek(date);
        // Also re-render the month view in the background
        if (activeTab === 'month') renderMonth();
      });
    });

    document.body.appendChild(overlay);
  }

  // ---------- Tab routing ----------

  function setTab(name) {
    activeTab = name;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
    renderActive();
  }

  function renderActive() {
    if (activeTab === 'today') renderToday();
    else if (activeTab === 'month') renderMonth();
    else if (activeTab === 'history') renderHistory();
    else if (activeTab === 'settings') renderSettings();
  }

  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => setTab(btn.dataset.view));
  });

  // Initial render
  setTab('today');
})();
