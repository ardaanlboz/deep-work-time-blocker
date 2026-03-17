const Store = require("electron-store");
const crypto = require("crypto");

const store = new Store({
  name: "deepwork-momentum",
  clearInvalidConfig: false,
  defaults: {
    dailyLogs: {},
    tasks: [],
    criticalOutcomes: {},
    weeklyReports: [],
    slipMode: {
      active: false,
      activatedAt: null,
      expiresAt: null,
      triggers: [],
    },
    targets: {
      deepWorkHours: 4,
      revenueWorkHours: 3,
      sleepHours: 7.5,
      maxScreenTimeMinutes: 120,
      caffeineCutoffTime: "14:00",
      maxCaffeineMg: 300,
      workoutDaysPerWeek: 5,
    },
  },
});

function uid() {
  return crypto.randomUUID();
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Daily Logs ─────────────────────────────────────────────

function getDailyLog(date) {
  const logs = store.get("dailyLogs") || {};
  return logs[date] || null;
}

function getAllDailyLogs() {
  return store.get("dailyLogs") || {};
}

function getDailyLogsRange(startDate, endDate) {
  const logs = store.get("dailyLogs") || {};
  const result = {};
  for (const [date, log] of Object.entries(logs)) {
    if (date >= startDate && date <= endDate) {
      result[date] = log;
    }
  }
  return result;
}

function getRecentDailyLogs(days = 7) {
  const end = todayStr();
  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  const startStr = start.toISOString().slice(0, 10);
  return getDailyLogsRange(startStr, end);
}

function saveDailyLog(date, data) {
  const logs = store.get("dailyLogs") || {};
  const existing = logs[date] || {};
  logs[date] = { ...existing, ...data, date };
  store.set("dailyLogs", logs);
  return logs[date];
}

function deleteDailyLog(date) {
  const logs = store.get("dailyLogs") || {};
  delete logs[date];
  store.set("dailyLogs", logs);
}

// ─── Tasks ──────────────────────────────────────────────────

function getTasksForDate(date) {
  const tasks = store.get("tasks") || [];
  return tasks.filter((t) => t.date === date);
}

function getAllTasks() {
  return store.get("tasks") || [];
}

function getTasksRange(startDate, endDate) {
  const tasks = store.get("tasks") || [];
  return tasks.filter((t) => t.date >= startDate && t.date <= endDate);
}

function createTask(taskData) {
  const tasks = store.get("tasks") || [];
  const task = {
    id: uid(),
    title: taskData.title || "",
    date: taskData.date || todayStr(),
    completed: false,
    priority: taskData.priority || "Should Do",
    workType: taskData.workType || "Tactical Work",
    pillar: taskData.pillar || "Admin",
    leverage: taskData.leverage || "Medium Leverage",
    estimatedDuration: taskData.estimatedDuration || 30,
    actualDuration: taskData.actualDuration || null,
    notes: taskData.notes || "",
    countsAsDeepWork: taskData.countsAsDeepWork || false,
    countsAsRevenueWork: taskData.countsAsRevenueWork || false,
    isCriticalOutcome: taskData.isCriticalOutcome || false,
    order: taskData.order ?? tasks.filter((t) => t.date === (taskData.date || todayStr())).length,
    createdAt: new Date().toISOString(),
  };
  tasks.push(task);
  store.set("tasks", tasks);
  return task;
}

function updateTask(taskId, updates) {
  const tasks = store.get("tasks") || [];
  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx === -1) return null;
  tasks[idx] = { ...tasks[idx], ...updates, id: taskId };
  store.set("tasks", tasks);
  return tasks[idx];
}

function deleteTask(taskId) {
  const tasks = store.get("tasks") || [];
  const filtered = tasks.filter((t) => t.id !== taskId);
  store.set("tasks", filtered);
}

function toggleTask(taskId) {
  const tasks = store.get("tasks") || [];
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return null;
  task.completed = !task.completed;
  store.set("tasks", tasks);
  return task;
}

function reorderTasks(date, orderedIds) {
  const tasks = store.get("tasks") || [];
  orderedIds.forEach((id, index) => {
    const task = tasks.find((t) => t.id === id);
    if (task) task.order = index;
  });
  store.set("tasks", tasks);
}

// ─── Critical Outcomes ──────────────────────────────────────

function getCriticalOutcomes(date) {
  const outcomes = store.get("criticalOutcomes") || {};
  return outcomes[date] || [];
}

function saveCriticalOutcomes(date, items) {
  const outcomes = store.get("criticalOutcomes") || {};
  outcomes[date] = items.map((item) => ({
    id: item.id || uid(),
    text: item.text || "",
    completed: item.completed || false,
  }));
  store.set("criticalOutcomes", outcomes);
  return outcomes[date];
}

function toggleCriticalOutcome(date, outcomeId) {
  const outcomes = store.get("criticalOutcomes") || {};
  const list = outcomes[date] || [];
  const item = list.find((o) => o.id === outcomeId);
  if (!item) return null;
  item.completed = !item.completed;
  outcomes[date] = list;
  store.set("criticalOutcomes", outcomes);
  return list;
}

// ─── Weekly Reports ─────────────────────────────────────────

function getWeeklyReports() {
  return store.get("weeklyReports") || [];
}

function saveWeeklyReport(report) {
  const reports = store.get("weeklyReports") || [];
  const existing = reports.findIndex(
    (r) => r.startDate === report.startDate && r.endDate === report.endDate
  );
  if (existing >= 0) {
    reports[existing] = { ...reports[existing], ...report };
  } else {
    reports.push(report);
  }
  store.set("weeklyReports", reports);
  return report;
}

// ─── Slip Mode ──────────────────────────────────────────────

function getSlipMode() {
  const slip = store.get("slipMode") || { active: false };
  if (slip.active && slip.expiresAt && new Date(slip.expiresAt) < new Date()) {
    slip.active = false;
    slip.triggers = [];
    store.set("slipMode", slip);
  }
  return slip;
}

function activateSlipMode(triggers, durationHours = 24) {
  const now = new Date();
  const expires = new Date(now.getTime() + durationHours * 60 * 60 * 1000);
  const slip = {
    active: true,
    activatedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    triggers: triggers || [],
  };
  store.set("slipMode", slip);
  return slip;
}

function deactivateSlipMode() {
  const slip = { active: false, activatedAt: null, expiresAt: null, triggers: [] };
  store.set("slipMode", slip);
  return slip;
}

// ─── Targets ────────────────────────────────────────────────

function getTargets() {
  return store.get("targets") || {};
}

function updateTargets(updates) {
  const current = store.get("targets") || {};
  const next = { ...current, ...updates };
  store.set("targets", next);
  return next;
}

// ─── Bulk / Utility ─────────────────────────────────────────

function clearAllData() {
  store.clear();
}

function exportAllData() {
  return {
    dailyLogs: store.get("dailyLogs"),
    tasks: store.get("tasks"),
    criticalOutcomes: store.get("criticalOutcomes"),
    weeklyReports: store.get("weeklyReports"),
    slipMode: store.get("slipMode"),
    targets: store.get("targets"),
  };
}

function importData(data) {
  if (data.dailyLogs) store.set("dailyLogs", data.dailyLogs);
  if (data.tasks) store.set("tasks", data.tasks);
  if (data.criticalOutcomes) store.set("criticalOutcomes", data.criticalOutcomes);
  if (data.weeklyReports) store.set("weeklyReports", data.weeklyReports);
  if (data.slipMode) store.set("slipMode", data.slipMode);
  if (data.targets) store.set("targets", data.targets);
}

module.exports = {
  uid,
  todayStr,
  getDailyLog,
  getAllDailyLogs,
  getDailyLogsRange,
  getRecentDailyLogs,
  saveDailyLog,
  deleteDailyLog,
  getTasksForDate,
  getAllTasks,
  getTasksRange,
  createTask,
  updateTask,
  deleteTask,
  toggleTask,
  reorderTasks,
  getCriticalOutcomes,
  saveCriticalOutcomes,
  toggleCriticalOutcome,
  getWeeklyReports,
  saveWeeklyReport,
  getSlipMode,
  activateSlipMode,
  deactivateSlipMode,
  getTargets,
  updateTargets,
  clearAllData,
  exportAllData,
  importData,
};
