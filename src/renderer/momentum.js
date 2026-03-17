/* ═══════════════════════════════════════════════════════════
   Life Momentum — Renderer Logic
   ═══════════════════════════════════════════════════════════ */

const api = window.deepworkApi;
const M = api.momentum;

// ─── State ──────────────────────────────────────────────────

let selectedDate = todayStr();
let calendarDate = new Date();
let calendarView = "month";
let charts = {};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const CATEGORY_MAP = {
  "Deep Work":      { workType: "Deep Work",      pillar: "Product",  countsAsDeepWork: true,  countsAsRevenueWork: false },
  "Revenue Work":   { workType: "Revenue Work",   pillar: "Revenue",  countsAsDeepWork: false, countsAsRevenueWork: true },
  "Product":        { workType: "Deep Work",      pillar: "Product",  countsAsDeepWork: true,  countsAsRevenueWork: false },
  "Content":        { workType: "Deep Work",      pillar: "Content",  countsAsDeepWork: true,  countsAsRevenueWork: false },
  "Tactical Work":  { workType: "Tactical Work",  pillar: "Admin",    countsAsDeepWork: false, countsAsRevenueWork: false },
  "Admin":          { workType: "Admin",           pillar: "Admin",    countsAsDeepWork: false, countsAsRevenueWork: false },
  "School":         { workType: "School",          pillar: "School",   countsAsDeepWork: true,  countsAsRevenueWork: false },
  "Health":         { workType: "Health",          pillar: "Health",   countsAsDeepWork: false, countsAsRevenueWork: false },
  "Personal":       { workType: "Personal",        pillar: "Personal", countsAsDeepWork: false, countsAsRevenueWork: false },
  "Recovery":       { workType: "Recovery",        pillar: "Health",   countsAsDeepWork: false, countsAsRevenueWork: false },
};

function deriveFromCategory(category) {
  return CATEGORY_MAP[category] || CATEGORY_MAP["Tactical Work"];
}

async function invoke(channel, payload) {
  const result = await api.invoke(channel, payload);
  if (result && !result.ok) {
    console.error(`IPC error [${channel}]:`, result.error);
    return null;
  }
  return result?.data ?? result;
}

// ─── Tab Navigation ─────────────────────────────────────────

document.querySelectorAll(".nav-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".nav-tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    tab.classList.add("active");
    const tabId = "tab" + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1);
    document.getElementById(tabId).classList.add("active");

    // Refresh tab data
    if (tab.dataset.tab === "today") refreshToday();
    if (tab.dataset.tab === "calendar") refreshCalendar();
    if (tab.dataset.tab === "checkin") loadCheckinDate(selectedDate);
    if (tab.dataset.tab === "analytics") refreshAnalytics();
  });
});

// Back to Focus
document.getElementById("navBack").addEventListener("click", () => {
  invoke(M.NAVIGATE, { page: "focus" });
});

// ─── Command Center ─────────────────────────────────────────

async function refreshToday() {
  const date = todayStr();
  const [log, tasks, outcomes, metrics, targets, slipData] = await Promise.all([
    invoke(M.LOG_GET, { date }),
    invoke(M.TASKS_GET, { date }),
    invoke(M.OUTCOMES_GET, { date }),
    invoke(M.SCORE_COMPUTE, { date }),
    invoke(M.TARGETS_GET),
    invoke(M.SLIP_DETECT),
  ]);

  // Date display
  document.getElementById("ccDateDisplay").textContent = formatDate(date);

  // Score
  const score = metrics?.momentumScore ?? (log?.momentumScore ?? "--");
  const scoreEl = document.getElementById("ccScoreValue");
  scoreEl.textContent = score;
  scoreEl.className = "score-value " + (score >= 70 ? "score-high" : score >= 50 ? "score-mid" : score < 50 && score !== "--" ? "score-low" : "");

  // Won the day
  const won = metrics?.wonTheDay ?? log?.wonTheDay;
  const wonEl = document.getElementById("ccWonDay");
  const wonIcon = wonEl.querySelector(".won-icon");
  const wonText = wonEl.querySelector(".won-text");
  if (won === true) {
    wonIcon.textContent = "+";
    wonText.textContent = "Won";
    wonText.style.color = "#22c55e";
  } else if (won === false) {
    wonIcon.textContent = "-";
    wonText.textContent = "Not yet";
    wonText.style.color = "#f59e0b";
  } else {
    wonIcon.textContent = "--";
    wonText.textContent = "No data";
    wonText.style.color = "";
  }

  // Critical outcomes
  const outEl = document.getElementById("ccOutcomes");
  if (outcomes && outcomes.length > 0) {
    outEl.innerHTML = outcomes.map((o) => `
      <div class="outcome-item ${o.completed ? "completed" : ""}">
        <div class="outcome-check ${o.completed ? "done" : ""}" data-id="${o.id}"></div>
        <span>${o.text}</span>
      </div>
    `).join("");
    outEl.querySelectorAll(".outcome-check").forEach((el) => {
      el.addEventListener("click", async () => {
        await invoke(M.OUTCOME_TOGGLE, { date, id: el.dataset.id });
        refreshToday();
      });
    });
  } else {
    outEl.innerHTML = '<div class="empty-state-small">No outcomes set</div>';
  }

  // Task progress
  const taskArr = tasks || [];
  const completed = taskArr.filter((t) => t.completed).length;
  const total = taskArr.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const progressEl = document.getElementById("ccTaskProgress");
  progressEl.querySelector(".progress-fill").style.width = pct + "%";
  progressEl.querySelector(".progress-text").textContent = `${completed}/${total} tasks`;

  // Deep work / revenue work
  const tgt = targets || {};
  document.getElementById("ccDeepWork").textContent =
    `${log?.deepWorkHours ?? 0}h / ${tgt.deepWorkHours ?? 4}h`;
  document.getElementById("ccRevenueWork").textContent =
    `${log?.revenueWorkHours ?? 0}h / ${tgt.revenueWorkHours ?? 3}h`;

  // Recovery info
  document.getElementById("ccSleep").textContent =
    log?.sleepHours ? `${log.sleepHours}h (${log.sleepQuality || "?"}/10)` : "--";
  document.getElementById("ccWorkout").textContent =
    log?.workoutCompleted ? `Yes (${log.workoutType || ""})` : log ? "No" : "--";
  document.getElementById("ccCaffeine").textContent =
    log?.caffeineTotalMg != null ? `${log.caffeineTotalMg}mg${log.lateCaffeineFlag ? " (late!)" : ""}` : "--";

  // Trend note
  const insights = await invoke(M.ANALYTICS_INSIGHTS);
  if (insights && insights.length > 0) {
    document.getElementById("ccTrendNote").textContent = insights[0].text;
  }

  // Today tasks
  renderTaskList("todayTaskList", taskArr, date);

  // Populate quick check-in with existing data
  if (log) {
    setVal("qcSleep", log.sleepHours);
    setVal("qcSleepQuality", log.sleepQuality);
    setVal("qcDeepWork", log.deepWorkHours);
    setVal("qcRevenueWork", log.revenueWorkHours);
    document.getElementById("qcWorkout").checked = !!log.workoutCompleted;
    setVal("qcEnergy", log.energyLevel);
    setVal("qcScreenTime", log.screenTimeMinutes);
    setVal("qcCaffeine", log.caffeineTotalMg);
  }

  // Slip mode
  if (slipData?.isSlipping) {
    document.getElementById("slipBadge").classList.remove("hidden");
    showSlipMode(slipData);
  } else {
    document.getElementById("slipBadge").classList.add("hidden");
    document.getElementById("slipModePanel").classList.add("hidden");
  }
}

function setVal(id, val) {
  if (val != null) document.getElementById(id).value = val;
}

// ─── Slip Mode ──────────────────────────────────────────────

async function showSlipMode(slipData) {
  const panel = document.getElementById("slipModePanel");
  panel.classList.remove("hidden");

  document.getElementById("slipTriggers").innerHTML = slipData.triggers
    .map((t) => `<div class="slip-trigger-item">${t}</div>`).join("");

  const plan = await invoke(M.SLIP_RESET_PLAN);
  if (plan) {
    document.getElementById("slipPlan").innerHTML = plan.recommendations
      .map((r) => `<div class="slip-rec"><span class="slip-rec-cat">${r.category}</span><span>${r.action}</span></div>`)
      .join("");
  }
}

document.getElementById("slipDismiss").addEventListener("click", () => {
  document.getElementById("slipModePanel").classList.add("hidden");
});

// ─── Task Rendering ─────────────────────────────────────────

function renderTaskList(containerId, tasks, date) {
  const container = document.getElementById(containerId);
  const sorted = [...tasks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (sorted.length === 0) {
    container.innerHTML = '<div class="empty-state-small">No tasks</div>';
    return;
  }

  container.innerHTML = sorted.map((t) => {
    const prioClass = t.priority === "Must Do" ? "tag-must-do" :
      t.priority === "Should Do" ? "tag-should-do" :
      t.priority === "Nice to Do" ? "tag-nice-to-do" : "tag-delegate";
    const tags = [];
    tags.push(`<span class="task-tag ${prioClass}">${t.priority}</span>`);
    if (t.leverage === "High Leverage") tags.push('<span class="task-tag tag-high">High</span>');
    if (t.countsAsDeepWork) tags.push('<span class="task-tag tag-deep">Deep</span>');
    if (t.countsAsRevenueWork) tags.push('<span class="task-tag tag-revenue">Rev</span>');

    return `
      <div class="task-item ${t.completed ? "completed" : ""}" data-id="${t.id}">
        <div class="task-check ${t.completed ? "done" : ""}" data-id="${t.id}">${t.completed ? "✓" : ""}</div>
        <span class="task-title">${t.title}</span>
        <div class="task-meta">${tags.join("")}</div>
        <button class="task-delete" data-id="${t.id}">×</button>
      </div>
    `;
  }).join("");

  container.querySelectorAll(".task-check").forEach((el) => {
    el.addEventListener("click", async () => {
      await invoke(M.TASK_TOGGLE, { id: el.dataset.id });
      refreshAfterTaskChange(date, containerId);
    });
  });

  container.querySelectorAll(".task-delete").forEach((el) => {
    el.addEventListener("click", async () => {
      await invoke(M.TASK_DELETE, { id: el.dataset.id });
      refreshAfterTaskChange(date, containerId);
    });
  });
}

async function refreshAfterTaskChange(date, containerId) {
  const tasks = await invoke(M.TASKS_GET, { date });
  renderTaskList(containerId, tasks || [], date);
  if (date === todayStr()) refreshToday();
}

// Quick add task
document.getElementById("quickTaskAdd").addEventListener("click", async () => {
  const input = document.getElementById("quickTaskInput");
  const title = input.value.trim();
  if (!title) return;
  const priority = document.getElementById("quickTaskPriority").value;
  await invoke(M.TASK_CREATE, { title, date: todayStr(), priority });
  input.value = "";
  refreshAfterTaskChange(todayStr(), "todayTaskList");
});

document.getElementById("quickTaskInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("quickTaskAdd").click();
});

// Quick check-in save
document.getElementById("quickCheckinSave").addEventListener("click", async () => {
  const data = {};
  const fields = {
    qcSleep: "sleepHours",
    qcSleepQuality: "sleepQuality",
    qcDeepWork: "deepWorkHours",
    qcRevenueWork: "revenueWorkHours",
    qcEnergy: "energyLevel",
    qcScreenTime: "screenTimeMinutes",
    qcCaffeine: "caffeineTotalMg",
  };
  for (const [elId, key] of Object.entries(fields)) {
    const val = document.getElementById(elId).value;
    if (val !== "") data[key] = Number(val);
  }
  data.workoutCompleted = document.getElementById("qcWorkout").checked;
  await invoke(M.LOG_SAVE, { date: todayStr(), data });
  refreshToday();
});

// ─── Calendar ───────────────────────────────────────────────

async function refreshCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  document.getElementById("calMonthLabel").textContent =
    calendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const grid = document.getElementById("calendarGrid");

  if (calendarView === "month") {
    renderMonthView(grid, year, month);
  } else {
    renderWeekView(grid);
  }
}

async function renderMonthView(grid, year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayStr();

  // Get all logs for this month
  const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  const logs = await invoke(M.LOG_GET_RANGE, { startDate, endDate }) || {};

  const headers = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let html = headers.map((h) => `<div class="cal-header-cell">${h}</div>`).join("");

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="cal-cell other-month"></div>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isToday = dateStr === today;
    const isSelected = dateStr === selectedDate;
    const log = logs[dateStr];
    const score = log?.momentumScore;

    let dotClass = "";
    if (score != null) {
      dotClass = score >= 70 ? "high" : score >= 50 ? "mid" : "low";
    }

    html += `
      <div class="cal-cell ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}" data-date="${dateStr}">
        <span class="cal-day-number">${d}</span>
        ${dotClass ? `<div class="cal-score-dot ${dotClass}"></div>` : ""}
      </div>
    `;
  }

  grid.innerHTML = html;

  grid.querySelectorAll(".cal-cell[data-date]").forEach((cell) => {
    cell.addEventListener("click", () => {
      selectedDate = cell.dataset.date;
      refreshCalendar();
      showDayDetail(selectedDate);
    });
  });
}

async function renderWeekView(grid) {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - dayOfWeek);

  const headers = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let html = headers.map((h) => `<div class="cal-header-cell">${h}</div>`).join("");

  const startStr = weekStart.toISOString().slice(0, 10);
  const endDate = new Date(weekStart);
  endDate.setDate(endDate.getDate() + 6);
  const endStr = endDate.toISOString().slice(0, 10);
  const logs = await invoke(M.LOG_GET_RANGE, { startDate: startStr, endDate: endStr }) || {};

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const isToday = dateStr === todayStr();
    const isSelected = dateStr === selectedDate;
    const log = logs[dateStr];
    const score = log?.momentumScore;
    let dotClass = score != null ? (score >= 70 ? "high" : score >= 50 ? "mid" : "low") : "";

    html += `
      <div class="cal-cell ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}" data-date="${dateStr}">
        <span class="cal-day-number">${d.getDate()}</span>
        ${dotClass ? `<div class="cal-score-dot ${dotClass}"></div>` : ""}
      </div>
    `;
  }

  grid.innerHTML = html;
  grid.querySelectorAll(".cal-cell[data-date]").forEach((cell) => {
    cell.addEventListener("click", () => {
      selectedDate = cell.dataset.date;
      refreshCalendar();
      showDayDetail(selectedDate);
    });
  });
}

document.getElementById("calPrev").addEventListener("click", () => {
  calendarDate.setMonth(calendarDate.getMonth() - 1);
  refreshCalendar();
});

document.getElementById("calNext").addEventListener("click", () => {
  calendarDate.setMonth(calendarDate.getMonth() + 1);
  refreshCalendar();
});

document.querySelectorAll(".cal-view-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".cal-view-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    calendarView = btn.dataset.view;
    refreshCalendar();
  });
});

// ─── Day Detail ─────────────────────────────────────────────

async function showDayDetail(date) {
  const panel = document.getElementById("dayDetailPanel");
  panel.classList.remove("hidden");

  document.getElementById("dayDetailDate").textContent = formatDate(date);

  const [log, tasks, outcomes, metrics] = await Promise.all([
    invoke(M.LOG_GET, { date }),
    invoke(M.TASKS_GET, { date }),
    invoke(M.OUTCOMES_GET, { date }),
    invoke(M.SCORE_COMPUTE, { date }),
  ]);

  const score = metrics?.momentumScore ?? log?.momentumScore ?? "--";
  const scoreEl = document.getElementById("dayDetailScore");
  scoreEl.textContent = `Score: ${score}`;
  scoreEl.className = "badge " + (score >= 70 ? "active" : "");

  // Outcomes
  const outEl = document.getElementById("dayOutcomes");
  const outArr = outcomes || [];
  if (outArr.length > 0) {
    outEl.innerHTML = outArr.map((o) => `
      <div class="outcome-item ${o.completed ? "completed" : ""}">
        <div class="outcome-check ${o.completed ? "done" : ""}" data-id="${o.id}"></div>
        <span>${o.text}</span>
      </div>
    `).join("");
    outEl.querySelectorAll(".outcome-check").forEach((el) => {
      el.addEventListener("click", async () => {
        await invoke(M.OUTCOME_TOGGLE, { date, id: el.dataset.id });
        showDayDetail(date);
      });
    });
  } else {
    outEl.innerHTML = '<div class="empty-state-small">No outcomes set</div>';
  }

  // Add outcome
  document.getElementById("addOutcomeBtn").onclick = async () => {
    const input = document.getElementById("addOutcomeInput");
    const text = input.value.trim();
    if (!text) return;
    const current = outcomes || [];
    current.push({ text, completed: false });
    await invoke(M.OUTCOMES_SAVE, { date, items: current });
    input.value = "";
    showDayDetail(date);
  };

  // Tasks
  renderTaskList("dayTaskList", tasks || [], date);

  // Add task form
  document.getElementById("tfAddTask").onclick = async () => {
    const title = document.getElementById("tfTitle").value.trim();
    if (!title) return;
    const category = document.getElementById("tfCategory").value;
    const derived = deriveFromCategory(category);
    await invoke(M.TASK_CREATE, {
      title,
      date,
      priority: document.getElementById("tfPriority").value,
      workType: derived.workType,
      pillar: derived.pillar,
      leverage: document.getElementById("tfLeverage").value,
      estimatedDuration: Number(document.getElementById("tfDuration").value) || 30,
      countsAsDeepWork: derived.countsAsDeepWork,
      countsAsRevenueWork: derived.countsAsRevenueWork,
    });
    document.getElementById("tfTitle").value = "";
    showDayDetail(date);
    if (date === todayStr()) refreshToday();
  };
}

// ─── Check-In ───────────────────────────────────────────────

function loadCheckinDate(date) {
  selectedDate = date;
  document.getElementById("ciDate").value = date;
  loadCheckinData(date);
}

document.getElementById("ciLoadDay").addEventListener("click", () => {
  const date = document.getElementById("ciDate").value;
  if (date) loadCheckinDate(date);
});

async function loadCheckinData(date) {
  const log = await invoke(M.LOG_GET, { date });
  if (!log) {
    clearCheckinForm();
    return;
  }

  const fields = {
    ciSleepHours: "sleepHours",
    ciSleepQuality: "sleepQuality",
    ciSleepStart: "sleepStart",
    ciSleepEnd: "sleepEnd",
    ciDeepWork: "deepWorkHours",
    ciProductiveHours: "productiveHours",
    ciRevenueWork: "revenueWorkHours",
    ciFirstBlock: "firstProductiveBlockTime",
    ciExecQuality: "executionQuality",
    ciSelfTrust: "selfTrustScore",
    ciWorkoutDuration: "workoutDuration",
    ciEnergy: "energyLevel",
    ciScreenTime: "screenTimeMinutes",
    ciDistractionTime: "distractionMinutes",
    ciCaffeineMg: "caffeineTotalMg",
    ciDiscipline: "disciplineScore",
    ciMoodStability: "moodStability",
    ciShutdownQuality: "shutdownQualityScore",
    ciStrengthened: "reflectionStrengthened",
    ciWeakened: "reflectionWeakened",
    ciAvoided: "reflectionAvoided",
    ciMattered: "reflectionMattered",
    ciTomorrow: "reflectionTomorrow",
  };

  for (const [elId, key] of Object.entries(fields)) {
    const el = document.getElementById(elId);
    if (el && log[key] != null) el.value = log[key];
  }

  document.getElementById("ciWorkoutDone").checked = !!log.workoutCompleted;
  if (log.workoutType) document.getElementById("ciWorkoutType").value = log.workoutType;
  document.getElementById("ciLateCaffeine").checked = !!log.lateCaffeineFlag;

  // Emotion chips
  document.querySelectorAll("#ciEmotionChips .chip").forEach((chip) => {
    chip.classList.toggle("active", (log.emotionTags || []).includes(chip.dataset.tag));
  });

  // Discipline break chips
  document.querySelectorAll("#ciDisciplineChips .chip").forEach((chip) => {
    chip.classList.toggle("active", (log.brokeDisciplineReasons || []).includes(chip.dataset.reason));
  });
}

function clearCheckinForm() {
  document.querySelectorAll("#tabCheckin input[type='number'], #tabCheckin input[type='time']")
    .forEach((el) => { el.value = ""; });
  document.querySelectorAll("#tabCheckin textarea").forEach((el) => { el.value = ""; });
  document.querySelectorAll("#tabCheckin input[type='checkbox']").forEach((el) => { el.checked = false; });
  document.querySelectorAll("#tabCheckin .chip").forEach((el) => { el.classList.remove("active"); });
  document.getElementById("ciWorkoutType").value = "";
}

// Chip toggle handlers
document.querySelectorAll("#ciEmotionChips .chip").forEach((chip) => {
  chip.addEventListener("click", () => chip.classList.toggle("active"));
});

document.querySelectorAll("#ciDisciplineChips .chip").forEach((chip) => {
  chip.addEventListener("click", () => chip.classList.toggle("active"));
});

// Save check-in
document.getElementById("ciSave").addEventListener("click", async () => {
  const date = document.getElementById("ciDate").value || todayStr();
  const emotionTags = [];
  document.querySelectorAll("#ciEmotionChips .chip.active").forEach((c) => emotionTags.push(c.dataset.tag));
  const brokeDisciplineReasons = [];
  document.querySelectorAll("#ciDisciplineChips .chip.active").forEach((c) => brokeDisciplineReasons.push(c.dataset.reason));

  const data = {
    sleepHours: numOrNull("ciSleepHours"),
    sleepQuality: numOrNull("ciSleepQuality"),
    sleepStart: strOrNull("ciSleepStart"),
    sleepEnd: strOrNull("ciSleepEnd"),
    deepWorkHours: numOrNull("ciDeepWork"),
    productiveHours: numOrNull("ciProductiveHours"),
    revenueWorkHours: numOrNull("ciRevenueWork"),
    firstProductiveBlockTime: strOrNull("ciFirstBlock"),
    executionQuality: numOrNull("ciExecQuality"),
    selfTrustScore: numOrNull("ciSelfTrust"),
    workoutCompleted: document.getElementById("ciWorkoutDone").checked,
    workoutType: strOrNull("ciWorkoutType"),
    workoutDuration: numOrNull("ciWorkoutDuration"),
    energyLevel: numOrNull("ciEnergy"),
    screenTimeMinutes: numOrNull("ciScreenTime"),
    distractionMinutes: numOrNull("ciDistractionTime"),
    caffeineTotalMg: numOrNull("ciCaffeineMg"),
    lateCaffeineFlag: document.getElementById("ciLateCaffeine").checked,
    disciplineScore: numOrNull("ciDiscipline"),
    moodStability: numOrNull("ciMoodStability"),
    shutdownQualityScore: numOrNull("ciShutdownQuality"),
    emotionTags,
    brokeDisciplineReasons,
    reflectionStrengthened: strOrNull("ciStrengthened"),
    reflectionWeakened: strOrNull("ciWeakened"),
    reflectionAvoided: strOrNull("ciAvoided"),
    reflectionMattered: strOrNull("ciMattered"),
    reflectionTomorrow: strOrNull("ciTomorrow"),
  };

  await invoke(M.LOG_SAVE, { date, data });
  document.getElementById("ciSaveStatus").textContent = "Saved!";
  setTimeout(() => { document.getElementById("ciSaveStatus").textContent = ""; }, 2000);
});

function numOrNull(id) {
  const v = document.getElementById(id).value;
  return v !== "" ? Number(v) : null;
}

function strOrNull(id) {
  const v = document.getElementById(id).value;
  return v || null;
}

// ─── Analytics ──────────────────────────────────────────────

async function refreshAnalytics() {
  const [averages, streaks, insights, correlations, disciplineBreaks, plannedVsDone] = await Promise.all([
    invoke(M.ANALYTICS_AVERAGES),
    invoke(M.ANALYTICS_STREAKS),
    invoke(M.ANALYTICS_INSIGHTS),
    invoke(M.ANALYTICS_CORRELATIONS),
    invoke(M.ANALYTICS_DISCIPLINE_BREAKS),
    invoke(M.ANALYTICS_PLANNED_VS_DONE, { days: 14 }),
  ]);

  // Summary cards
  if (averages) {
    document.getElementById("asWeeklyAvg").textContent = averages.momentumScore?.weekly ?? "--";
    document.getElementById("asMonthlyAvg").textContent = averages.momentumScore?.monthly ?? "--";
  }

  if (streaks) {
    document.getElementById("asDaysWon").textContent = streaks.wonDay?.current ?? 0;
    document.getElementById("asStreak").textContent = streaks.momentumAbove70?.current ?? 0;
  }

  // Render streaks
  if (streaks) {
    const streakEl = document.getElementById("streakCards");
    const streakData = [
      { label: "Won Day", ...streaks.wonDay },
      { label: "Momentum 70+", ...streaks.momentumAbove70 },
      { label: "Workout", ...streaks.workout },
      { label: "Good Sleep", ...streaks.goodSleep },
      { label: "Deep Work 3h+", ...streaks.deepWork },
      { label: "No Late Caffeine", ...streaks.noCaffeineLate },
      { label: "Low Screen", ...streaks.lowScreenTime },
    ];
    streakEl.innerHTML = streakData.map((s) => `
      <div class="streak-card">
        <div class="streak-current">${s.current || 0}</div>
        <div class="streak-label">${s.label}</div>
        <div class="streak-best">Best: ${s.best || 0}</div>
      </div>
    `).join("");
  }

  // Insights
  if (insights) {
    const insightsEl = document.getElementById("insightsList");
    insightsEl.innerHTML = insights.map((i) =>
      `<div class="insight-item ${i.type}">${i.text}</div>`
    ).join("") || '<div class="empty-state-small">Not enough data for insights</div>';
  }

  // Correlations
  if (correlations) {
    const corrEl = document.getElementById("correlationsList");
    corrEl.innerHTML = correlations.map((c) => `
      <div class="corr-item">
        <span>${c.label}</span>
        <span class="corr-value ${c.correlation > 0 ? "positive" : "negative"}">${c.correlation > 0 ? "+" : ""}${c.correlation}</span>
      </div>
    `).join("") || '<div class="empty-state-small">Not enough data</div>';
  }

  // Discipline breaks
  if (disciplineBreaks && disciplineBreaks.length > 0) {
    const dbEl = document.getElementById("disciplineBreaks");
    dbEl.innerHTML = disciplineBreaks.map((d) => `
      <div class="db-item">
        <div class="db-reason">${d.reason}</div>
        <div class="db-count">${d.count}</div>
        <div class="db-pct">${d.percentage}% of bad days</div>
      </div>
    `).join("");
  }

  // Charts
  await renderCharts(plannedVsDone);
}

async function renderCharts(plannedVsDone) {
  if (typeof Chart === "undefined") {
    console.warn("Chart.js not loaded");
    return;
  }

  const chartColors = {
    primary: "#2563eb",
    primaryLight: "rgba(37, 99, 235, 0.15)",
    danger: "#dc2626",
    dangerLight: "rgba(220, 38, 38, 0.15)",
    success: "#22c55e",
    successLight: "rgba(34, 197, 94, 0.15)",
    warning: "#f59e0b",
    warningLight: "rgba(245, 158, 11, 0.15)",
    muted: "rgba(148, 163, 184, 0.3)",
  };

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { grid: { color: chartColors.muted }, ticks: { font: { size: 10 } } },
    },
  };

  // Momentum trend
  const momentumData = await invoke(M.ANALYTICS_TRENDS, { metric: "momentumScore", days: 30 });
  if (momentumData) {
    renderLineChart("chartMomentum", momentumData, "Momentum", chartColors.primary, chartColors.primaryLight, commonOptions);
  }

  // Deep work
  const dwData = await invoke(M.ANALYTICS_TRENDS, { metric: "deepWorkHours", days: 14 });
  if (dwData) {
    renderBarChart("chartDeepWork", dwData, "Deep Work (h)", chartColors.primary, commonOptions);
  }

  // Sleep quality
  const sleepData = await invoke(M.ANALYTICS_TRENDS, { metric: "sleepQuality", days: 14 });
  if (sleepData) {
    renderLineChart("chartSleep", sleepData, "Sleep Quality", chartColors.success, chartColors.successLight, commonOptions);
  }

  // Screen time
  const screenData = await invoke(M.ANALYTICS_TRENDS, { metric: "screenTimeMinutes", days: 14 });
  if (screenData) {
    renderBarChart("chartScreenTime", screenData, "Screen Time (min)", chartColors.danger, commonOptions);
  }

  // Planned vs completed
  if (plannedVsDone) {
    renderPvDChart("chartPlannedDone", plannedVsDone, commonOptions, chartColors);
  }
}

function renderLineChart(canvasId, data, label, color, bgColor, options) {
  if (charts[canvasId]) charts[canvasId].destroy();
  const ctx = document.getElementById(canvasId).getContext("2d");
  charts[canvasId] = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.map((d) => formatDateShort(d.date)),
      datasets: [{
        label,
        data: data.map((d) => d.value),
        borderColor: color,
        backgroundColor: bgColor,
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        borderWidth: 2,
      }],
    },
    options,
  });
}

function renderBarChart(canvasId, data, label, color, options) {
  if (charts[canvasId]) charts[canvasId].destroy();
  const ctx = document.getElementById(canvasId).getContext("2d");
  charts[canvasId] = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.map((d) => formatDateShort(d.date)),
      datasets: [{
        label,
        data: data.map((d) => d.value),
        backgroundColor: color + "33",
        borderColor: color,
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options,
  });
}

function renderPvDChart(canvasId, data, options, colors) {
  if (charts[canvasId]) charts[canvasId].destroy();
  const ctx = document.getElementById(canvasId).getContext("2d");
  charts[canvasId] = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.map((d) => formatDateShort(d.date)),
      datasets: [
        {
          label: "Planned",
          data: data.map((d) => d.planned),
          backgroundColor: colors.muted,
          borderRadius: 4,
        },
        {
          label: "Completed",
          data: data.map((d) => d.completed),
          backgroundColor: colors.primary + "55",
          borderColor: colors.primary,
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      ...options,
      plugins: { legend: { display: true, position: "top", labels: { boxWidth: 12, font: { size: 10 } } } },
    },
  });
}

// ─── Advisor ────────────────────────────────────────────────

async function showPromptOutput(title, promptData) {
  const panel = document.getElementById("advisorOutput");
  panel.classList.remove("hidden");
  document.getElementById("advOutputTitle").textContent = title;
  document.getElementById("advSystemPrompt").textContent = promptData.system || "";
  document.getElementById("advUserPrompt").textContent = promptData.user || "";
}

document.getElementById("advDailyReview").addEventListener("click", async () => {
  const prompt = await invoke(M.LLM_DAILY_REVIEW, { date: todayStr() });
  if (prompt) showPromptOutput("Daily Review Prompt", prompt);
});

document.getElementById("advTomorrowPlan").addEventListener("click", async () => {
  const prompt = await invoke(M.LLM_TOMORROW_PLAN);
  if (prompt) showPromptOutput("Tomorrow Plan Prompt", prompt);
});

document.getElementById("advWeeklyReport").addEventListener("click", async () => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - dayOfWeek - 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const prompt = await invoke(M.LLM_WEEKLY_REPORT, {
    startDate: weekStart.toISOString().slice(0, 10),
    endDate: weekEnd.toISOString().slice(0, 10),
  });
  if (prompt) showPromptOutput("Weekly Report Prompt", prompt);
});

document.getElementById("advSlipMode").addEventListener("click", async () => {
  const prompt = await invoke(M.LLM_SLIP_MODE);
  if (prompt) showPromptOutput("Slip Recovery Prompt", prompt);
});

document.getElementById("advCopy").addEventListener("click", () => {
  const system = document.getElementById("advSystemPrompt").textContent;
  const user = document.getElementById("advUserPrompt").textContent;
  const text = `SYSTEM:\n${system}\n\nUSER:\n${user}`;
  navigator.clipboard.writeText(text).then(() => {
    document.getElementById("advCopy").textContent = "Copied!";
    setTimeout(() => { document.getElementById("advCopy").textContent = "Copy to Clipboard"; }, 1500);
  });
});

// ─── Seed / Clear Data ──────────────────────────────────────

document.getElementById("seedDataBtn").addEventListener("click", async () => {
  await invoke(M.SEED_DATA);
  refreshToday();
});

document.getElementById("clearDataBtn").addEventListener("click", async () => {
  await invoke(M.CLEAR_DATA);
  refreshToday();
});

// ─── Init ───────────────────────────────────────────────────

(async function init() {
  document.getElementById("ciDate").value = todayStr();
  await refreshToday();
})();
