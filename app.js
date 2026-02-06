/* ==========================
   LifeOS — Working App (v1)
   - Habits (daily toggle + streak)
   - Assignments (due dates + complete)
   - Focus timer logs study minutes
   - Appearance presets (accent + light/dark)
   - localStorage persistence
   ========================== */

const $ = (q, el = document) => el.querySelector(q);
const $$ = (q, el = document) => [...el.querySelectorAll(q)];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

/* ---------- Dates ---------- */
function pad2(n) { return String(n).padStart(2, "0"); }
function toISODate(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
}
function parseISODate(s) {
    // yyyy-mm-dd -> Date at local midnight
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setHours(0, 0, 0, 0);
    return dt;
}
function startOfWeek(d) {
    // Mon start
    const dt = new Date(d);
    dt.setHours(0, 0, 0, 0);
    const day = (dt.getDay() + 6) % 7; // Mon=0
    dt.setDate(dt.getDate() - day);
    return dt;
}
function endOfWeek(d) {
    const s = startOfWeek(d);
    const e = new Date(s);
    e.setDate(e.getDate() + 6);
    return e;
}
function daysBetween(a, b) {
    const A = new Date(a); A.setHours(0, 0, 0, 0);
    const B = new Date(b); B.setHours(0, 0, 0, 0);
    return Math.round((B - A) / (24 * 60 * 60 * 1000));
}
function formatFriendlyDate(iso) {
    const dt = parseISODate(iso);
    return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* ---------- Storage ---------- */
const KEY = "lifeos_v1";
const COLOR_PRESETS = [
    { id: "ocean", label: "Ocean", rgb: "10, 132, 255" },
    { id: "mint", label: "Mint", rgb: "52, 199, 89" },
    { id: "sunset", label: "Sunset", rgb: "255, 159, 10" },
    { id: "rose", label: "Rose", rgb: "255, 59, 48" },
    { id: "violet", label: "Violet", rgb: "99, 102, 241" },
];
function uid() { return Math.random().toString(16).slice(2) + Date.now().toString(16); }

function loadState() {
    const raw = localStorage.getItem(KEY);
    if (raw) {
        try { return JSON.parse(raw); } catch { /* fallthrough */ }
    }
    // defaults
    const today = toISODate(new Date());
    return {
        theme: localStorage.getItem("lifeos_theme") || "light",
        palette: localStorage.getItem("lifeos_palette") || "ocean",
        studyGoal: 120,
        studyLog: {
            // isoDate: minutes
            [today]: 0
        },
        focusSessions: [
            // { id, isoDate, minutes, endedAtISO }
        ],
        habits: [
            // { id, title, history: { [isoDate]: true } }
        ],
        assignments: [
            // { id, title, course, dueISO, done: false }
        ],
    };
}

function saveState() {
    localStorage.setItem(KEY, JSON.stringify(state));
}

/* ---------- App State ---------- */
const state = loadState();
if (!state.theme) state.theme = "light";
if (!state.palette || !COLOR_PRESETS.some(p => p.id === state.palette)) state.palette = "ocean";

/* ---------- Theme ---------- */
function getPalette(id) {
    return COLOR_PRESETS.find(p => p.id === id) || COLOR_PRESETS[0];
}

function updateAppearanceButton() {
    const preset = getPalette(state.palette);
    const btn = $("#themeBtn");
    btn.style.color = `rgb(${preset.rgb})`;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="2.8" fill="currentColor"></circle>
      <path d="M12 3.5v2.1M12 18.4v2.1M3.5 12h2.1M18.4 12h2.1M5.9 5.9l1.5 1.5M16.6 16.6l1.5 1.5M5.9 18.1l1.5-1.5M16.6 7.4l1.5-1.5"
            stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".9"></path>
    </svg>`;
}

function setTheme(t, persist = true) {
    document.documentElement.setAttribute("data-theme", t === "dark" ? "dark" : "light");
    state.theme = t;
    if (persist) localStorage.setItem("lifeos_theme", t);
    const themeColor = $('meta[name="theme-color"]');
    if (themeColor) {
        themeColor.setAttribute("content", t === "dark" ? "#070a12" : "#f6f7fb");
    }
    if (persist) saveState();
}

function setPalette(id, persist = true) {
    const preset = getPalette(id);
    state.palette = preset.id;
    document.documentElement.style.setProperty("--accent-rgb", preset.rgb);
    if (persist) {
        localStorage.setItem("lifeos_palette", preset.id);
        saveState();
    }
    updateAppearanceButton();
}

function syncTabbarClearance() {
    const bar = $(".tabbar");
    if (!bar) return;
    const h = Math.ceil(bar.getBoundingClientRect().height);
    document.documentElement.style.setProperty("--tabbar-height", `${h}px`);
}

function syncAppearanceSheet() {
    if (!sheet.classList.contains("open")) return;
    if ($("#sheetTitle")?.textContent !== "Appearance") return;
    $$(".modeBtn", sheetForm).forEach(btn => {
        btn.classList.toggle("active", btn.dataset.mode === state.theme);
    });
    $$(".swatchBtn", sheetForm).forEach(btn => {
        btn.classList.toggle("active", btn.dataset.palette === state.palette);
    });
    const modeHint = $("#modeHint");
    if (modeHint) modeHint.textContent = state.theme === "dark" ? "Dark mode active" : "Light mode active";
    const colorHint = $("#colorHint");
    if (colorHint) colorHint.textContent = `Preset: ${getPalette(state.palette).label}`;
}

function openAppearanceSheet() {
    const swatches = COLOR_PRESETS.map(p => `
      <button
        class="swatchBtn${p.id === state.palette ? " active" : ""}"
        type="button"
        data-palette="${p.id}"
        aria-label="${p.label}"
        title="${p.label}"
        style="background: linear-gradient(180deg, rgb(${p.rgb}), color-mix(in srgb, rgb(${p.rgb}) 78%, black 22%));"
      ></button>
    `).join("");

    sheetForm.innerHTML = `
      <div class="field">
        <label>Mode</label>
        <div class="modeRow">
          <button class="modeBtn${state.theme === "light" ? " active" : ""}" type="button" data-mode="light">Light</button>
          <button class="modeBtn${state.theme === "dark" ? " active" : ""}" type="button" data-mode="dark">Dark</button>
        </div>
        <div class="meta" id="modeHint">${state.theme === "dark" ? "Dark mode active" : "Light mode active"}</div>
      </div>

      <div class="field">
        <label>Accent Color</label>
        <div class="paletteGrid">${swatches}</div>
        <div class="meta" id="colorHint">Preset: ${getPalette(state.palette).label}</div>
      </div>

      <div class="sheetActions">
        <button class="primary" id="appearanceDone" type="button">Done</button>
      </div>
    `;

    $$(".modeBtn", sheetForm).forEach(btn => {
        btn.addEventListener("click", () => {
            setTheme(btn.dataset.mode);
            syncAppearanceSheet();
        });
    });
    $$(".swatchBtn", sheetForm).forEach(btn => {
        btn.addEventListener("click", () => {
            setPalette(btn.dataset.palette);
            syncAppearanceSheet();
        });
    });
    $("#appearanceDone")?.addEventListener("click", closeSheet);
}

function setThemeAndPalette() {
    setTheme(state.theme || "light", false);
    setPalette(state.palette || "ocean", false);
    saveState();
}

/* ---------- Appearance ---------- */
function openAppearance() {
    $("#sheetTitle").textContent = "Appearance";
    $("#sheetSub").textContent = "Preset colors + light/dark mode";
    sheetForm.innerHTML = "";
    openAppearanceSheet();
    sheetForm.onsubmit = null;
}

/* ---------- Rings ---------- */
function setProgress(circleEl, pct) {
    const r = 15.5;
    const C = 2 * Math.PI * r;
    circleEl.style.strokeDasharray = `${C}`;
    const p = clamp(pct, 0, 100) / 100;
    circleEl.style.strokeDashoffset = `${C * (1 - p)}`;
}

/* ---------- Habits ---------- */
function habitDoneToday(habit, isoToday) {
    return !!habit.history?.[isoToday];
}

function toggleHabitToday(habitId) {
    const isoToday = toISODate(new Date());
    const h = state.habits.find(x => x.id === habitId);
    if (!h) return;
    if (!h.history) h.history = {};
    h.history[isoToday] = !h.history[isoToday];
    saveState();
    renderAll();
}

function computeStreak() {
    // streak across all habits: how many consecutive days ALL habits were completed?
    // (Feels more “Apple rings”)
    if (state.habits.length === 0) return 0;

    const today = parseISODate(toISODate(new Date()));
    let streak = 0;

    for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const iso = toISODate(d);

        const allDone = state.habits.every(h => !!h.history?.[iso]);
        if (allDone) streak++;
        else break;
    }
    return streak;
}

/* ---------- Assignments ---------- */
function sortedAssignments() {
    // not done first, then due date
    return state.assignments.slice().sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return parseISODate(a.dueISO) - parseISODate(b.dueISO);
    });
}

function toggleAssignmentDone(id) {
    const a = state.assignments.find(x => x.id === id);
    if (!a) return;
    a.done = !a.done;
    saveState();
    renderAll();
}

function getAssignmentStats() {
    const now = new Date();
    const todayISO = toISODate(now);
    const today = parseISODate(todayISO);
    const weekStart = startOfWeek(today);
    const weekEnd = endOfWeek(today);

    let overdue = 0;
    let week = 0;

    for (const a of state.assignments) {
        if (a.done) continue;
        const due = parseISODate(a.dueISO);
        if (due < today) overdue++;
        if (due >= weekStart && due <= weekEnd) week++;
    }
    return { overdue, week };
}

function nextUpAssignment() {
    const today = parseISODate(toISODate(new Date()));
    const pending = state.assignments
        .filter(a => !a.done)
        .slice()
        .sort((a, b) => parseISODate(a.dueISO) - parseISODate(b.dueISO));
    if (pending.length === 0) return null;

    // prefer nearest due (even overdue)
    const a = pending[0];
    const due = parseISODate(a.dueISO);
    const diff = daysBetween(today, due); // due - today in days
    return { ...a, diffDays: diff };
}

/* ---------- Study / Focus ---------- */
function getStudyMinutes(isoDate) {
    return state.studyLog?.[isoDate] || 0;
}

function addStudyMinutes(isoDate, minutes) {
    if (!state.studyLog) state.studyLog = {};
    state.studyLog[isoDate] = (state.studyLog[isoDate] || 0) + minutes;
    saveState();
}

/* ---------- Bottom Sheet ---------- */
const sheet = $("#sheet");
const sheetBackdrop = $("#sheetBackdrop");
const sheetForm = $("#sheetForm");

function openSheet(type) {
    // type: addHabit | addAssignment | appearance
    if (type === "appearance") {
        openAppearance();
        sheetBackdrop.classList.add("open");
        sheet.classList.add("open");
        sheet.setAttribute("aria-hidden", "false");
        sheetBackdrop.setAttribute("aria-hidden", "false");
        return;
    }

    $("#sheetTitle").textContent = type === "addHabit" ? "Add Habit" : "Add Assignment";
    $("#sheetSub").textContent = type === "addHabit"
        ? "Daily habit • streak-ready"
        : "Due date • clean control";

    sheetForm.innerHTML = "";

    if (type === "addHabit") {
        sheetForm.innerHTML = `
      <div class="field">
        <label>Habit name</label>
        <input class="input" name="title" placeholder="e.g. Code 30 minutes" required maxlength="60"/>
      </div>

      <div class="sheetActions">
        <button class="primary" type="submit">Add Habit</button>
      </div>
    `;

        sheetForm.onsubmit = (e) => {
            e.preventDefault();
            const fd = new FormData(sheetForm);
            const title = String(fd.get("title") || "").trim();
            if (!title) return;

            state.habits.unshift({ id: uid(), title, history: {} });
            saveState();
            closeSheet();
            renderAll();
        };
    }

    if (type === "addAssignment") {
        const todayISO = toISODate(new Date());
        sheetForm.innerHTML = `
      <div class="field">
        <label>Title</label>
        <input class="input" name="title" placeholder="e.g. HW 3 (BST)" required maxlength="80"/>
      </div>

      <div class="field">
        <label>Course (optional)</label>
        <input class="input" name="course" placeholder="e.g. Data Structures" maxlength="40"/>
      </div>

      <div class="field">
        <label>Due date</label>
        <input class="input" name="dueISO" type="date" value="${todayISO}" required />
      </div>

      <div class="sheetActions">
        <button class="primary" type="submit">Add Assignment</button>
      </div>
    `;

        sheetForm.onsubmit = (e) => {
            e.preventDefault();
            const fd = new FormData(sheetForm);
            const title = String(fd.get("title") || "").trim();
            const course = String(fd.get("course") || "").trim();
            const dueISO = String(fd.get("dueISO") || "").trim();
            if (!title || !dueISO) return;

            state.assignments.unshift({ id: uid(), title, course, dueISO, done: false });
            saveState();
            closeSheet();
            renderAll();
        };
    }

    sheetBackdrop.classList.add("open");
    sheet.classList.add("open");
    sheet.setAttribute("aria-hidden", "false");
    sheetBackdrop.setAttribute("aria-hidden", "false");
}

function closeSheet() {
    sheetBackdrop.classList.remove("open");
    sheet.classList.remove("open");
    sheet.setAttribute("aria-hidden", "true");
    sheetBackdrop.setAttribute("aria-hidden", "true");
    sheetForm.onsubmit = null;
}

/* ---------- Views ---------- */
function setView(name) {
    $$(".view").forEach(v => v.classList.toggle("active", v.dataset.view === name));
    $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
    syncTabbarClearance();
}

/* ---------- Focus Timer ---------- */
const timerState = {
    minutes: 25,
    running: false,
    endAt: null,
    intervalId: null
};

function fmt(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function stopTimer() {
    timerState.running = false;
    timerState.endAt = null;
    if (timerState.intervalId) clearInterval(timerState.intervalId);
    timerState.intervalId = null;
    $("#timerToggle").textContent = "Start";
    $("#timerState").textContent = "Ready";
    $("#timerMeta").textContent = "Deep work mode.";
    $("#timerLabel").textContent = `${String(timerState.minutes).padStart(2, "0")}:00`;
}

function startTimer() {
    timerState.running = true;
    timerState.endAt = Date.now() + timerState.minutes * 60 * 1000;

    $("#timerToggle").textContent = "Stop";
    $("#timerState").textContent = "Running";
    $("#timerMeta").textContent = "No multitasking. You got this.";

    timerState.intervalId = setInterval(() => {
        const left = timerState.endAt - Date.now();
        $("#timerLabel").textContent = fmt(left);

        if (left <= 0) {
            clearInterval(timerState.intervalId);
            timerState.intervalId = null;
            timerState.running = false;

            $("#timerState").textContent = "Done";
            $("#timerMeta").textContent = "Logged to study minutes.";
            $("#timerToggle").textContent = "Reset";

            const iso = toISODate(new Date());
            addStudyMinutes(iso, timerState.minutes);

            state.focusSessions.unshift({
                id: uid(),
                isoDate: iso,
                minutes: timerState.minutes,
                endedAtISO: new Date().toISOString()
            });
            saveState();
            renderAll();
        }
    }, 250);
}

/* ---------- Rendering ---------- */
function renderToday() {
    const now = new Date();
    const isoToday = toISODate(now);
    $("#dateLine").textContent = now.toLocaleDateString(undefined, {
        weekday: "long", month: "long", day: "numeric"
    });

    // Study
    const doneMin = getStudyMinutes(isoToday);
    const goal = state.studyGoal || 120;
    const pctStudy = goal ? (doneMin / goal) * 100 : 0;
    setProgress($("#studyRing"), pctStudy);
    $("#studyText").textContent = `${doneMin} / ${goal}m`;
    $("#studyHint").textContent =
        pctStudy >= 100 ? "Goal crushed." :
            pctStudy >= 60 ? "Nice pace." : "You’re warming up.";

    // Habits
    const totalHabits = state.habits.length;
    const doneHabits = state.habits.filter(h => habitDoneToday(h, isoToday)).length;
    const pctHabits = totalHabits ? (doneHabits / totalHabits) * 100 : 0;
    setProgress($("#habitRing"), pctHabits);
    $("#habitText").textContent = `${doneHabits} / ${totalHabits}`;
    $("#habitHint").textContent =
        totalHabits === 0 ? "Add your first habit." :
            pctHabits >= 100 ? "Perfect day." :
                pctHabits >= 60 ? "Keep rolling." : "Start with one.";

    // Streak
    const streak = computeStreak();
    $("#streakBadge").textContent = `Streak: ${streak}d`;

    // Next up + stats
    const stats = getAssignmentStats();
    $("#overdueBadge").textContent = `Overdue: ${stats.overdue}`;
    $("#weekBadge").textContent = `This week: ${stats.week}`;

    const next = nextUpAssignment();
    const badge = $("#nextUpBadge");
    if (!next) {
        $("#nextUpTitle").textContent = "No deadlines yet";
        $("#nextUpMeta").textContent = "Add an assignment to start.";
        badge.textContent = "—";
        badge.className = "badge";
    } else {
        $("#nextUpTitle").textContent = next.title;
        const dueText = next.course ? `${next.course} • ${formatFriendlyDate(next.dueISO)}` : formatFriendlyDate(next.dueISO);
        if (next.diffDays < 0) {
            badge.textContent = "Overdue";
            badge.className = "badge bad";
            $("#nextUpMeta").textContent = `${dueText} • overdue by ${Math.abs(next.diffDays)} day(s)`;
        } else if (next.diffDays === 0) {
            badge.textContent = "Today";
            badge.className = "badge warn";
            $("#nextUpMeta").textContent = `${dueText} • due today`;
        } else if (next.diffDays === 1) {
            badge.textContent = "Tomorrow";
            badge.className = "badge warn";
            $("#nextUpMeta").textContent = `${dueText} • due tomorrow`;
        } else {
            badge.textContent = `${next.diffDays}d`;
            badge.className = "badge";
            $("#nextUpMeta").textContent = `${dueText} • due in ${next.diffDays} day(s)`;
        }
    }

    // Quick habits pills
    const quick = $("#habitQuickList");
    quick.innerHTML = "";
    if (state.habits.length === 0) {
        const empty = document.createElement("div");
        empty.className = "meta";
        empty.textContent = "Add a habit to start building streaks.";
        quick.appendChild(empty);
    } else {
        state.habits.slice(0, 8).forEach(h => {
            const done = habitDoneToday(h, isoToday);
            const b = document.createElement("button");
            b.type = "button";
            b.className = "pill" + (done ? " done" : "");
            b.innerHTML = `<span class="dot"></span>${h.title}`;
            b.onclick = () => toggleHabitToday(h.id);
            quick.appendChild(b);
        });
    }

    // Assignment preview (latest 1 pending)
    const preview = $("#todayAssignmentPreview");
    preview.innerHTML = "";
    const pending = state.assignments.filter(a => !a.done).slice(0, 1);
    if (pending.length === 0) {
        const e = document.createElement("div");
        e.className = "meta";
        e.textContent = "No pending assignments. Enjoy the calm.";
        preview.appendChild(e);
    } else {
        pending.forEach(a => preview.appendChild(renderAssignmentItem(a)));
    }
}

function renderAssignmentItem(a) {
    const item = document.createElement("div");
    item.className = "item";

    const today = parseISODate(toISODate(new Date()));
    const due = parseISODate(a.dueISO);
    const diff = daysBetween(today, due);

    let badgeText = `${formatFriendlyDate(a.dueISO)}`;
    let badgeClass = "badge";
    let sub = a.course ? a.course : "Assignment";

    if (diff < 0) {
        badgeText = "Late";
        badgeClass = "badge bad";
        sub += ` • overdue by ${Math.abs(diff)} day(s)`;
    } else if (diff === 0) {
        badgeText = "Today";
        badgeClass = "badge warn";
        sub += " • due today";
    } else if (diff === 1) {
        badgeText = "Tomorrow";
        badgeClass = "badge warn";
        sub += " • due tomorrow";
    } else {
        sub += ` • due in ${diff} day(s)`;
    }

    item.innerHTML = `
    <div>
      <p class="itemTitle">${a.title}</p>
      <p class="itemSub">${sub}</p>
    </div>
    <div class="itemRight">
      <span class="${badgeClass}">${badgeText}</span>
      <span class="badge">${a.done ? "Done" : "Tap"}</span>
    </div>
  `;

    item.onclick = () => toggleAssignmentDone(a.id);
    return item;
}

function renderSchool() {
    const list = $("#assignmentList");
    list.innerHTML = "";

    const all = sortedAssignments();
    $("#assignmentCountBadge").textContent = `${all.filter(a => !a.done).length} open`;

    if (all.length === 0) {
        const e = document.createElement("div");
        e.className = "meta";
        e.textContent = "No assignments yet. Add one to start.";
        list.appendChild(e);
        return;
    }

    all.forEach(a => {
        const item = renderAssignmentItem(a);
        if (a.done) item.style.opacity = "0.65";
        list.appendChild(item);
    });
}

function renderHabits() {
    const list = $("#habitList");
    list.innerHTML = "";
    const isoToday = toISODate(new Date());

    const total = state.habits.length;
    const done = state.habits.filter(h => habitDoneToday(h, isoToday)).length;
    $("#habitOverviewBadge").textContent = `${done} / ${total}`;

    if (total === 0) {
        const e = document.createElement("div");
        e.className = "meta";
        e.textContent = "Add your first habit. Keep it small and daily.";
        list.appendChild(e);
        return;
    }

    state.habits.forEach(h => {
        const isDone = habitDoneToday(h, isoToday);
        const item = document.createElement("div");
        item.className = "item";
        item.innerHTML = `
      <div>
        <p class="itemTitle">${h.title}</p>
        <p class="itemSub">${isDone ? "Completed today" : "Not done yet"}</p>
      </div>
      <div class="itemRight">
        <span class="${isDone ? "badge good" : "badge"}">${isDone ? "Done" : "Tap"}</span>
        <span class="badge">${"Daily"}</span>
      </div>
    `;
        item.onclick = () => toggleHabitToday(h.id);
        list.appendChild(item);
    });
}

function renderSessions() {
    const wrap = $("#sessionList");
    wrap.innerHTML = "";

    const sessions = (state.focusSessions || []).slice(0, 6);
    if (sessions.length === 0) {
        const e = document.createElement("div");
        e.className = "meta";
        e.textContent = "Finish a focus timer to log sessions.";
        wrap.appendChild(e);
        return;
    }

    sessions.forEach(s => {
        const item = document.createElement("div");
        item.className = "item";
        item.style.cursor = "default";
        item.onclick = null;

        const when = new Date(s.endedAtISO).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
        item.innerHTML = `
      <div>
        <p class="itemTitle">${s.minutes} minute focus</p>
        <p class="itemSub">${when}</p>
      </div>
      <div class="itemRight">
        <span class="badge good">Logged</span>
      </div>
    `;
        wrap.appendChild(item);
    });
}

/* ---------- Render All ---------- */
function renderAll() {
    renderToday();
    renderSchool();
    renderHabits();
    renderSessions();
    syncTabbarClearance();
}

/* ---------- Events ---------- */
function wireEvents() {
    // tabs
    $$(".tab").forEach(t => t.addEventListener("click", () => setView(t.dataset.tab)));

    // appearance
    $("#themeBtn").addEventListener("click", () => {
        openSheet("appearance");
    });

    // open sheet buttons
    $$("[data-open-sheet]").forEach(b => {
        b.addEventListener("click", () => openSheet(b.dataset.openSheet));
    });

    // sheet close/backdrop
    $("#sheetClose").addEventListener("click", closeSheet);
    $("#sheetBackdrop").addEventListener("click", closeSheet);

    // Today -> Focus
    $("#startFocus").addEventListener("click", () => setView("focus"));
    $("#seeMoreAssignments").addEventListener("click", () => setView("school"));

    // timer length
    $$(".seg button[data-len]").forEach(btn => {
        btn.addEventListener("click", () => {
            if (timerState.running) return;
            $$(".seg button[data-len]").forEach(b => b.classList.toggle("active", b === btn));
            timerState.minutes = Number(btn.dataset.len);
            $("#timerLabel").textContent = `${String(timerState.minutes).padStart(2, "0")}:00`;
        });
    });

    // timer start/stop/reset
    $("#timerToggle").addEventListener("click", () => {
        const label = $("#timerToggle").textContent;
        if (label === "Reset") {
            stopTimer();
            return;
        }
        if (timerState.running) stopTimer();
        else startTimer();
    });

    // allow Esc close sheet
    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeSheet();
    });
    window.addEventListener("resize", syncTabbarClearance);
    if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", syncTabbarClearance);
    }
}

/* ---------- Init ---------- */
function init() {
    setThemeAndPalette();
    wireEvents();
    renderAll();
}
init();
