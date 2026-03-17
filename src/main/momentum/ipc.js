/**
 * Momentum IPC Handlers
 * Registers all momentum-related IPC channels.
 */

const { ipcMain } = require("electron");
const { logInfo, logError } = require("../logger");
const store = require("./store");
const scoring = require("./scoring");
const analytics = require("./analytics");
const slip = require("./slip");
const llm = require("./llmPrompts");
const { generateSeedData } = require("./seed");

const MOMENTUM_CHANNELS = {
  // Daily logs
  LOG_GET: "momentum:log:get",
  LOG_GET_ALL: "momentum:log:getAll",
  LOG_GET_RANGE: "momentum:log:getRange",
  LOG_GET_RECENT: "momentum:log:getRecent",
  LOG_SAVE: "momentum:log:save",
  LOG_DELETE: "momentum:log:delete",

  // Tasks
  TASKS_GET: "momentum:tasks:get",
  TASKS_GET_ALL: "momentum:tasks:getAll",
  TASKS_GET_RANGE: "momentum:tasks:getRange",
  TASK_CREATE: "momentum:task:create",
  TASK_UPDATE: "momentum:task:update",
  TASK_DELETE: "momentum:task:delete",
  TASK_TOGGLE: "momentum:task:toggle",
  TASKS_REORDER: "momentum:tasks:reorder",

  // Critical outcomes
  OUTCOMES_GET: "momentum:outcomes:get",
  OUTCOMES_SAVE: "momentum:outcomes:save",
  OUTCOME_TOGGLE: "momentum:outcome:toggle",

  // Scoring
  SCORE_COMPUTE: "momentum:score:compute",
  SCORE_COMPUTE_ALL: "momentum:score:computeAll",

  // Analytics
  ANALYTICS_TRENDS: "momentum:analytics:trends",
  ANALYTICS_STREAKS: "momentum:analytics:streaks",
  ANALYTICS_BEST_WORST: "momentum:analytics:bestWorst",
  ANALYTICS_BREAKDOWN: "momentum:analytics:breakdown",
  ANALYTICS_PLANNED_VS_DONE: "momentum:analytics:plannedVsDone",
  ANALYTICS_HEATMAP: "momentum:analytics:heatmap",
  ANALYTICS_CORRELATIONS: "momentum:analytics:correlations",
  ANALYTICS_INSIGHTS: "momentum:analytics:insights",
  ANALYTICS_DISCIPLINE_BREAKS: "momentum:analytics:disciplineBreaks",
  ANALYTICS_AVERAGES: "momentum:analytics:averages",

  // Slip mode
  SLIP_DETECT: "momentum:slip:detect",
  SLIP_RESET_PLAN: "momentum:slip:resetPlan",
  SLIP_GET: "momentum:slip:get",
  SLIP_ACTIVATE: "momentum:slip:activate",
  SLIP_DEACTIVATE: "momentum:slip:deactivate",

  // LLM prompts
  LLM_DAILY_REVIEW: "momentum:llm:dailyReview",
  LLM_TOMORROW_PLAN: "momentum:llm:tomorrowPlan",
  LLM_WEEKLY_REPORT: "momentum:llm:weeklyReport",
  LLM_SLIP_MODE: "momentum:llm:slipMode",

  // Targets
  TARGETS_GET: "momentum:targets:get",
  TARGETS_UPDATE: "momentum:targets:update",

  // Weekly reports
  WEEKLY_REPORTS_GET: "momentum:weeklyReports:get",
  WEEKLY_REPORT_SAVE: "momentum:weeklyReport:save",

  // Data management
  SEED_DATA: "momentum:seed",
  EXPORT_DATA: "momentum:export",
  IMPORT_DATA: "momentum:import",
  CLEAR_DATA: "momentum:clear",

  // Navigation
  NAVIGATE: "momentum:navigate",
};

async function safeInvoke(handler) {
  try {
    const data = await handler();
    return { ok: true, data };
  } catch (error) {
    logError("Momentum IPC call failed", { error: error.message });
    return { ok: false, error: error.message };
  }
}

function registerMomentumIpcHandlers(mainWindow) {
  // ─── Daily Logs ─────────────────────────────────────────
  ipcMain.handle(MOMENTUM_CHANNELS.LOG_GET, (_e, payload) =>
    safeInvoke(() => store.getDailyLog(payload.date))
  );

  ipcMain.handle(MOMENTUM_CHANNELS.LOG_GET_ALL, () =>
    safeInvoke(() => store.getAllDailyLogs())
  );

  ipcMain.handle(MOMENTUM_CHANNELS.LOG_GET_RANGE, (_e, payload) =>
    safeInvoke(() => store.getDailyLogsRange(payload.startDate, payload.endDate))
  );

  ipcMain.handle(MOMENTUM_CHANNELS.LOG_GET_RECENT, (_e, payload) =>
    safeInvoke(() => store.getRecentDailyLogs(payload?.days || 7))
  );

  ipcMain.handle(MOMENTUM_CHANNELS.LOG_SAVE, (_e, payload) =>
    safeInvoke(() => {
      const saved = store.saveDailyLog(payload.date, payload.data);
      // Recompute scores after saving
      const tasks = store.getTasksForDate(payload.date);
      const outcomes = store.getCriticalOutcomes(payload.date);
      const targets = store.getTargets();
      const metrics = scoring.computeAllDailyMetrics(saved, tasks, outcomes, targets);
      // Store computed scores in the log
      const withScores = store.saveDailyLog(payload.date, {
        momentumScore: metrics.momentumScore,
        wonTheDay: metrics.wonTheDay,
        dopamineProtectionScore: metrics.dopamineProtectionScore,
        executionScore: metrics.executionScore,
        recoveryScore: metrics.recoveryScore,
      });
      logInfo("Daily log saved", { date: payload.date, score: metrics.momentumScore });
      return { log: withScores, metrics };
    })
  );

  ipcMain.handle(MOMENTUM_CHANNELS.LOG_DELETE, (_e, payload) =>
    safeInvoke(() => store.deleteDailyLog(payload.date))
  );

  // ─── Tasks ──────────────────────────────────────────────
  ipcMain.handle(MOMENTUM_CHANNELS.TASKS_GET, (_e, payload) =>
    safeInvoke(() => store.getTasksForDate(payload.date))
  );

  ipcMain.handle(MOMENTUM_CHANNELS.TASKS_GET_ALL, () =>
    safeInvoke(() => store.getAllTasks())
  );

  ipcMain.handle(MOMENTUM_CHANNELS.TASKS_GET_RANGE, (_e, payload) =>
    safeInvoke(() => store.getTasksRange(payload.startDate, payload.endDate))
  );

  ipcMain.handle(MOMENTUM_CHANNELS.TASK_CREATE, (_e, payload) =>
    safeInvoke(() => store.createTask(payload))
  );

  ipcMain.handle(MOMENTUM_CHANNELS.TASK_UPDATE, (_e, payload) =>
    safeInvoke(() => store.updateTask(payload.id, payload.updates))
  );

  ipcMain.handle(MOMENTUM_CHANNELS.TASK_DELETE, (_e, payload) =>
    safeInvoke(() => store.deleteTask(payload.id))
  );

  ipcMain.handle(MOMENTUM_CHANNELS.TASK_TOGGLE, (_e, payload) =>
    safeInvoke(() => store.toggleTask(payload.id))
  );

  ipcMain.handle(MOMENTUM_CHANNELS.TASKS_REORDER, (_e, payload) =>
    safeInvoke(() => store.reorderTasks(payload.date, payload.orderedIds))
  );

  // ─── Critical Outcomes ──────────────────────────────────
  ipcMain.handle(MOMENTUM_CHANNELS.OUTCOMES_GET, (_e, payload) =>
    safeInvoke(() => store.getCriticalOutcomes(payload.date))
  );

  ipcMain.handle(MOMENTUM_CHANNELS.OUTCOMES_SAVE, (_e, payload) =>
    safeInvoke(() => store.saveCriticalOutcomes(payload.date, payload.items))
  );

  ipcMain.handle(MOMENTUM_CHANNELS.OUTCOME_TOGGLE, (_e, payload) =>
    safeInvoke(() => store.toggleCriticalOutcome(payload.date, payload.id))
  );

  // ─── Scoring ────────────────────────────────────────────
  ipcMain.handle(MOMENTUM_CHANNELS.SCORE_COMPUTE, (_e, payload) =>
    safeInvoke(() => {
      const log = store.getDailyLog(payload.date);
      if (!log) return null;
      const tasks = store.getTasksForDate(payload.date);
      const outcomes = store.getCriticalOutcomes(payload.date);
      const targets = store.getTargets();
      return scoring.computeAllDailyMetrics(log, tasks, outcomes, targets);
    })
  );

  ipcMain.handle(MOMENTUM_CHANNELS.SCORE_COMPUTE_ALL, () =>
    safeInvoke(() => {
      const logs = store.getAllDailyLogs();
      const allTasks = store.getAllTasks();
      const targets = store.getTargets();
      const results = {};
      for (const [date, log] of Object.entries(logs)) {
        const tasks = allTasks.filter((t) => t.date === date);
        const outcomes = store.getCriticalOutcomes(date);
        results[date] = scoring.computeAllDailyMetrics(log, tasks, outcomes, targets);
      }
      return results;
    })
  );

  // ─── Analytics ──────────────────────────────────────────
  ipcMain.handle(MOMENTUM_CHANNELS.ANALYTICS_TRENDS, (_e, payload) =>
    safeInvoke(() => {
      const logs = store.getAllDailyLogs();
      return analytics.getTrendData(logs, payload.metric, payload.days || 30);
    })
  );

  ipcMain.handle(MOMENTUM_CHANNELS.ANALYTICS_STREAKS, () =>
    safeInvoke(() => analytics.calculateStreaks(store.getAllDailyLogs()))
  );

  ipcMain.handle(MOMENTUM_CHANNELS.ANALYTICS_BEST_WORST, () =>
    safeInvoke(() => analytics.getBestWorstDays(store.getAllDailyLogs()))
  );

  ipcMain.handle(MOMENTUM_CHANNELS.ANALYTICS_BREAKDOWN, (_e, payload) =>
    safeInvoke(() => analytics.getCategoryBreakdown(store.getAllTasks(), payload?.dateRange))
  );

  ipcMain.handle(MOMENTUM_CHANNELS.ANALYTICS_PLANNED_VS_DONE, (_e, payload) =>
    safeInvoke(() => analytics.getPlannedVsCompleted(store.getAllTasks(), payload?.days || 14))
  );

  ipcMain.handle(MOMENTUM_CHANNELS.ANALYTICS_HEATMAP, (_e, payload) =>
    safeInvoke(() => analytics.getHabitHeatmap(store.getAllDailyLogs(), payload.metric, payload.year, payload.month))
  );

  ipcMain.handle(MOMENTUM_CHANNELS.ANALYTICS_CORRELATIONS, () =>
    safeInvoke(() => analytics.getCorrelations(store.getAllDailyLogs()))
  );

  ipcMain.handle(MOMENTUM_CHANNELS.ANALYTICS_INSIGHTS, () =>
    safeInvoke(() => {
      const logs = store.getAllDailyLogs();
      const tasks = store.getAllTasks();
      const targets = store.getTargets();
      return analytics.generateInsights(logs, tasks, targets);
    })
  );

  ipcMain.handle(MOMENTUM_CHANNELS.ANALYTICS_DISCIPLINE_BREAKS, () =>
    safeInvoke(() => analytics.analyzeDisciplineBreaks(store.getAllDailyLogs()))
  );

  ipcMain.handle(MOMENTUM_CHANNELS.ANALYTICS_AVERAGES, (_e, payload) =>
    safeInvoke(() => {
      const logs = store.getAllDailyLogs();
      const metrics = ["momentumScore", "sleepHours", "sleepQuality", "deepWorkHours",
        "revenueWorkHours", "screenTimeMinutes", "energyLevel", "moodStability"];
      const result = {};
      metrics.forEach((m) => {
        result[m] = {
          weekly: analytics.getWeeklyAverage(logs, m),
          monthly: analytics.getMonthlyAverage(logs, m),
        };
      });
      return result;
    })
  );

  // ─── Slip Mode ──────────────────────────────────────────
  ipcMain.handle(MOMENTUM_CHANNELS.SLIP_DETECT, () =>
    safeInvoke(() => {
      const logs = store.getAllDailyLogs();
      const tasks = store.getAllTasks();
      return slip.detectSlipRisk(logs, tasks);
    })
  );

  ipcMain.handle(MOMENTUM_CHANNELS.SLIP_RESET_PLAN, () =>
    safeInvoke(() => {
      const logs = store.getAllDailyLogs();
      const tasks = store.getAllTasks();
      const targets = store.getTargets();
      return slip.generateResetPlan(logs, tasks, targets);
    })
  );

  ipcMain.handle(MOMENTUM_CHANNELS.SLIP_GET, () =>
    safeInvoke(() => store.getSlipMode())
  );

  ipcMain.handle(MOMENTUM_CHANNELS.SLIP_ACTIVATE, (_e, payload) =>
    safeInvoke(() => store.activateSlipMode(payload.triggers, payload.durationHours))
  );

  ipcMain.handle(MOMENTUM_CHANNELS.SLIP_DEACTIVATE, () =>
    safeInvoke(() => store.deactivateSlipMode())
  );

  // ─── LLM Prompts ───────────────────────────────────────
  ipcMain.handle(MOMENTUM_CHANNELS.LLM_DAILY_REVIEW, (_e, payload) =>
    safeInvoke(() => {
      const log = store.getDailyLog(payload.date);
      if (!log) return null;
      const tasks = store.getTasksForDate(payload.date);
      const outcomes = store.getCriticalOutcomes(payload.date);
      const targets = store.getTargets();
      const metrics = scoring.computeAllDailyMetrics(log, tasks, outcomes, targets);
      const logs = store.getAllDailyLogs();
      const allTasks = store.getAllTasks();
      const insights = analytics.generateInsights(logs, allTasks, targets);
      return llm.buildDailyReviewPrompt(log, tasks, outcomes, metrics, insights, targets);
    })
  );

  ipcMain.handle(MOMENTUM_CHANNELS.LLM_TOMORROW_PLAN, () =>
    safeInvoke(() => {
      const logs = store.getRecentDailyLogs(5);
      const tasks = store.getAllTasks();
      const targets = store.getTargets();
      const slipMode = store.getSlipMode();
      const pendingTasks = tasks.filter((t) => !t.completed);
      return llm.buildTomorrowPlanPrompt(logs, pendingTasks, targets, slipMode);
    })
  );

  ipcMain.handle(MOMENTUM_CHANNELS.LLM_WEEKLY_REPORT, (_e, payload) =>
    safeInvoke(() => {
      const { startDate, endDate } = payload;
      const logs = store.getDailyLogsRange(startDate, endDate);
      const tasks = store.getTasksRange(startDate, endDate);
      const targets = store.getTargets();
      const logArr = Object.values(logs);

      const weekData = {
        startDate, endDate,
        totalDays: logArr.length,
        avgMomentum: logArr.length ? Math.round(logArr.reduce((s, l) => s + (l.momentumScore || 0), 0) / logArr.length) : 0,
        daysWon: logArr.filter((l) => l.wonTheDay).length,
        avgSleep: logArr.length ? Math.round(logArr.reduce((s, l) => s + (l.sleepHours || 0), 0) / logArr.length * 10) / 10 : 0,
        avgSleepQuality: logArr.length ? Math.round(logArr.reduce((s, l) => s + (l.sleepQuality || 0), 0) / logArr.length * 10) / 10 : 0,
        avgDeepWork: logArr.length ? Math.round(logArr.reduce((s, l) => s + (l.deepWorkHours || 0), 0) / logArr.length * 10) / 10 : 0,
        avgRevenueWork: logArr.length ? Math.round(logArr.reduce((s, l) => s + (l.revenueWorkHours || 0), 0) / logArr.length * 10) / 10 : 0,
        avgScreenTime: logArr.length ? Math.round(logArr.reduce((s, l) => s + (l.screenTimeMinutes || 0), 0) / logArr.length) : 0,
        workoutDays: logArr.filter((l) => l.workoutCompleted).length,
        totalTasksPlanned: tasks.length,
        totalTasksCompleted: tasks.filter((t) => t.completed).length,
        mustDosPlanned: tasks.filter((t) => t.priority === "Must Do").length,
        mustDosCompleted: tasks.filter((t) => t.priority === "Must Do" && t.completed).length,
        criticalOutcomesPlanned: 0,
        criticalOutcomesCompleted: 0,
        leverageRatio: scoring.calculateLeverageRatio(tasks),
        fakeProductivityDays: 0,
        lateCaffeineDays: logArr.filter((l) => l.lateCaffeineFlag).length,
        topDisciplineBreaks: [],
        insights: analytics.generateInsights(logs, tasks, targets),
      };

      // Count critical outcomes
      for (const date of Object.keys(logs)) {
        const outcomes = store.getCriticalOutcomes(date);
        weekData.criticalOutcomesPlanned += outcomes.length;
        weekData.criticalOutcomesCompleted += outcomes.filter((o) => o.completed).length;
      }

      return llm.buildWeeklyReportPrompt(weekData);
    })
  );

  ipcMain.handle(MOMENTUM_CHANNELS.LLM_SLIP_MODE, () =>
    safeInvoke(() => {
      const logs = store.getAllDailyLogs();
      const tasks = store.getAllTasks();
      const targets = store.getTargets();
      const slipData = slip.detectSlipRisk(logs, tasks);
      const resetPlan = slip.generateResetPlan(logs, tasks, targets);
      if (!resetPlan) return null;
      return llm.buildSlipModePrompt(slipData, resetPlan);
    })
  );

  // ─── Targets ────────────────────────────────────────────
  ipcMain.handle(MOMENTUM_CHANNELS.TARGETS_GET, () =>
    safeInvoke(() => store.getTargets())
  );

  ipcMain.handle(MOMENTUM_CHANNELS.TARGETS_UPDATE, (_e, payload) =>
    safeInvoke(() => store.updateTargets(payload))
  );

  // ─── Weekly Reports ─────────────────────────────────────
  ipcMain.handle(MOMENTUM_CHANNELS.WEEKLY_REPORTS_GET, () =>
    safeInvoke(() => store.getWeeklyReports())
  );

  ipcMain.handle(MOMENTUM_CHANNELS.WEEKLY_REPORT_SAVE, (_e, payload) =>
    safeInvoke(() => store.saveWeeklyReport(payload))
  );

  // ─── Data Management ───────────────────────────────────
  ipcMain.handle(MOMENTUM_CHANNELS.SEED_DATA, () =>
    safeInvoke(() => {
      const seed = generateSeedData();
      store.importData(seed);
      // Compute scores for all seeded data
      const targets = store.getTargets();
      const allTasks = store.getAllTasks();
      for (const [date, log] of Object.entries(seed.dailyLogs)) {
        const tasks = allTasks.filter((t) => t.date === date);
        const outcomes = store.getCriticalOutcomes(date);
        const metrics = scoring.computeAllDailyMetrics(log, tasks, outcomes, targets);
        store.saveDailyLog(date, {
          momentumScore: metrics.momentumScore,
          wonTheDay: metrics.wonTheDay,
          dopamineProtectionScore: metrics.dopamineProtectionScore,
          executionScore: metrics.executionScore,
          recoveryScore: metrics.recoveryScore,
        });
      }
      logInfo("Seed data generated");
      return { success: true };
    })
  );

  ipcMain.handle(MOMENTUM_CHANNELS.EXPORT_DATA, () =>
    safeInvoke(() => store.exportAllData())
  );

  ipcMain.handle(MOMENTUM_CHANNELS.IMPORT_DATA, (_e, payload) =>
    safeInvoke(() => store.importData(payload))
  );

  ipcMain.handle(MOMENTUM_CHANNELS.CLEAR_DATA, () =>
    safeInvoke(() => {
      store.clearAllData();
      logInfo("Momentum data cleared");
      return { success: true };
    })
  );

  // ─── Navigation ─────────────────────────────────────────
  ipcMain.handle(MOMENTUM_CHANNELS.NAVIGATE, (_e, payload) =>
    safeInvoke(() => {
      const path = require("path");
      const page = payload.page;
      if (page === "momentum") {
        mainWindow.loadFile(path.join(__dirname, "../../renderer/momentum.html"));
      } else {
        mainWindow.loadFile(path.join(__dirname, "../../renderer/index.html"));
      }
      return { navigated: page };
    })
  );

  return { MOMENTUM_CHANNELS };
}

module.exports = { MOMENTUM_CHANNELS, registerMomentumIpcHandlers };
