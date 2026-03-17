/**
 * Momentum Scoring Engine
 *
 * Strict scoring system (0-100) with weighted components.
 * Not adaptive — rewards consistency and penalizes gaps.
 *
 * Weights:
 *   Sleep Quality + Duration:       20
 *   Deep Work Hours:                15
 *   Revenue-Producing Work:         15
 *   Task Execution (Must Dos):      15
 *   Critical Outcomes Completed:    10
 *   Workout Completion:              8
 *   Dopamine Protection:             7
 *   Caffeine Timing Control:         5
 *   Self-Trust:                      3
 *   Shutdown Quality:                2
 *                              Total: 100
 */

const WEIGHTS = {
  sleep: 20,
  deepWork: 15,
  revenueWork: 15,
  taskExecution: 15,
  criticalOutcomes: 10,
  workout: 8,
  dopamineProtection: 7,
  caffeineTiming: 5,
  selfTrust: 3,
  shutdownQuality: 2,
};

// ─── Helper: clamp to 0-1 ───────────────────────────────────
function ratio(value, target) {
  if (!target || target <= 0) return 1;
  return Math.min(value / target, 1);
}

function clamp(v, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v));
}

function scoreFromRating(rating, maxRating = 10) {
  return clamp((rating || 0) / maxRating);
}

// ─── Component Scores (each returns 0-1) ────────────────────

function scoreSleep(log, targets) {
  const hourScore = ratio(log.sleepHours || 0, targets.sleepHours || 7.5);
  const qualityScore = scoreFromRating(log.sleepQuality);
  return hourScore * 0.5 + qualityScore * 0.5;
}

function scoreDeepWork(log, targets) {
  return ratio(log.deepWorkHours || 0, targets.deepWorkHours || 4);
}

function scoreRevenueWork(log, targets) {
  return ratio(log.revenueWorkHours || 0, targets.revenueWorkHours || 3);
}

function scoreTaskExecution(tasks) {
  const mustDos = tasks.filter((t) => t.priority === "Must Do");
  if (mustDos.length === 0) return 0.7; // no must-dos planned, partial credit
  const completed = mustDos.filter((t) => t.completed).length;
  return completed / mustDos.length;
}

function scoreCriticalOutcomes(outcomes) {
  if (!outcomes || outcomes.length === 0) return 0.5; // no outcomes set, partial
  const completed = outcomes.filter((o) => o.completed).length;
  return completed / outcomes.length;
}

function scoreWorkout(log) {
  return log.workoutCompleted ? 1 : 0;
}

function scoreDopamineProtection(log, targets) {
  const maxScreen = targets.maxScreenTimeMinutes || 120;
  const screenScore = 1 - clamp((log.screenTimeMinutes || 0) / (maxScreen * 2));
  const distractionPenalty = clamp((log.distractionMinutes || 0) / 120);
  const lateCaffeinePenalty = log.lateCaffeineFlag ? 0.3 : 0;
  const raw = screenScore * 0.5 + (1 - distractionPenalty) * 0.35 + (1 - lateCaffeinePenalty) * 0.15;
  return clamp(raw);
}

function scoreCaffeineTiming(log, targets) {
  if ((log.caffeineTotalMg || 0) === 0) return 1; // no caffeine = perfect
  const cutoff = targets.caffeineCutoffTime || "14:00";
  const entries = log.caffeineEntries || [];
  if (entries.length === 0) return log.lateCaffeineFlag ? 0.3 : 0.8;
  const lateEntries = entries.filter((e) => e.time > cutoff);
  if (lateEntries.length === 0) return 1;
  const lateRatio = lateEntries.length / entries.length;
  return clamp(1 - lateRatio * 0.8);
}

function scoreSelfTrust(log, tasks, outcomes) {
  // How closely did actual execution match stated commitments
  const mustDos = tasks.filter((t) => t.priority === "Must Do");
  const mustDoScore = mustDos.length > 0
    ? mustDos.filter((t) => t.completed).length / mustDos.length
    : 0.7;
  const outcomeScore = outcomes && outcomes.length > 0
    ? outcomes.filter((o) => o.completed).length / outcomes.length
    : 0.5;
  // Also factor in the user's self-reported self-trust
  const selfReported = scoreFromRating(log.selfTrustScore);
  return mustDoScore * 0.4 + outcomeScore * 0.35 + selfReported * 0.25;
}

function scoreShutdownQuality(log) {
  return scoreFromRating(log.shutdownQualityScore);
}

// ─── Main Momentum Score ────────────────────────────────────

function calculateMomentumScore(log, tasks, outcomes, targets) {
  if (!log) return { score: 0, components: {}, wonTheDay: false };

  const components = {
    sleep: scoreSleep(log, targets),
    deepWork: scoreDeepWork(log, targets),
    revenueWork: scoreRevenueWork(log, targets),
    taskExecution: scoreTaskExecution(tasks || []),
    criticalOutcomes: scoreCriticalOutcomes(outcomes),
    workout: scoreWorkout(log),
    dopamineProtection: scoreDopamineProtection(log, targets),
    caffeineTiming: scoreCaffeineTiming(log, targets),
    selfTrust: scoreSelfTrust(log, tasks || [], outcomes),
    shutdownQuality: scoreShutdownQuality(log),
  };

  let score = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    score += (components[key] || 0) * weight;
  }
  score = Math.round(clamp(score, 0, 100));

  const wonTheDay = score >= 70;

  return { score, components, wonTheDay };
}

// ─── Derived Scores ─────────────────────────────────────────

function calculateExecutionScore(log, tasks) {
  const mustDos = tasks.filter((t) => t.priority === "Must Do");
  const shouldDos = tasks.filter((t) => t.priority === "Should Do");
  const allPriority = [...mustDos, ...shouldDos];
  if (allPriority.length === 0) return 50;
  const completed = allPriority.filter((t) => t.completed).length;
  const executionQuality = scoreFromRating(log.executionQuality) * 100;
  const completionRate = (completed / allPriority.length) * 100;
  return Math.round(completionRate * 0.6 + executionQuality * 0.4);
}

function calculateRecoveryScore(log, targets) {
  const sleep = scoreSleep(log, targets);
  const workout = log.workoutCompleted ? 1 : 0;
  const energy = scoreFromRating(log.energyLevel);
  return Math.round((sleep * 0.45 + workout * 0.3 + energy * 0.25) * 100);
}

function calculateDopamineProtectionScore(log, targets) {
  return Math.round(scoreDopamineProtection(log, targets) * 100);
}

function calculateSelfTrustScore(log, tasks, outcomes) {
  return Math.round(scoreSelfTrust(log, tasks, outcomes) * 100);
}

function calculateLeverageRatio(tasks) {
  const completed = tasks.filter((t) => t.completed);
  if (completed.length === 0) return 0;
  const highLeverage = completed.filter((t) => t.leverage === "High Leverage").length;
  return Math.round((highLeverage / completed.length) * 100) / 100;
}

function calculateStrategicRatio(tasks) {
  const completed = tasks.filter((t) => t.completed);
  if (completed.length === 0) return 0;
  const strategic = completed.filter((t) =>
    ["Deep Work", "Revenue Work"].includes(t.workType)
  ).length;
  return Math.round((strategic / completed.length) * 100) / 100;
}

function detectFakeProductivity(log, tasks, outcomes) {
  const completedCount = tasks.filter((t) => t.completed).length;
  const criticalCompleted = (outcomes || []).filter((o) => o.completed).length;
  const totalCritical = (outcomes || []).length;
  const leverageRatio = calculateLeverageRatio(tasks);

  const signals = [];
  if (completedCount >= 5 && totalCritical > 0 && criticalCompleted === 0) {
    signals.push("Many tasks done but zero critical outcomes completed");
  }
  if (leverageRatio < 0.2 && completedCount >= 4) {
    signals.push("High task count but very low leverage ratio");
  }
  if ((log.productiveHours || 0) >= 5 && (log.revenueWorkHours || 0) < 1 && (log.deepWorkHours || 0) < 1.5) {
    signals.push("High productive hours but minimal deep/revenue work");
  }
  const adminTactical = tasks.filter(
    (t) => t.completed && ["Admin", "Tactical Work"].includes(t.workType)
  ).length;
  if (adminTactical >= 4 && completedCount > 0 && adminTactical / completedCount > 0.7) {
    signals.push("Over 70% of completed work was admin/tactical");
  }

  return {
    isFakeProductivity: signals.length >= 2,
    risk: signals.length >= 3 ? "high" : signals.length >= 2 ? "medium" : "low",
    signals,
  };
}

function calculateShutdownQualityScoreValue(log) {
  return Math.round(scoreFromRating(log.shutdownQualityScore) * 100);
}

// ─── Full Daily Metrics ─────────────────────────────────────

function computeAllDailyMetrics(log, tasks, outcomes, targets) {
  const momentum = calculateMomentumScore(log, tasks, outcomes, targets);
  const fakeProductivity = detectFakeProductivity(log, tasks, outcomes);

  return {
    momentumScore: momentum.score,
    wonTheDay: momentum.wonTheDay,
    scoreComponents: momentum.components,
    executionScore: calculateExecutionScore(log, tasks),
    recoveryScore: calculateRecoveryScore(log, targets),
    dopamineProtectionScore: calculateDopamineProtectionScore(log, targets),
    selfTrustScore: calculateSelfTrustScore(log, tasks, outcomes),
    leverageRatio: calculateLeverageRatio(tasks),
    strategicRatio: calculateStrategicRatio(tasks),
    fakeProductivity,
    shutdownQualityScore: calculateShutdownQualityScoreValue(log),
    firstProductiveBlockTime: log.firstProductiveBlockTime || null,
  };
}

module.exports = {
  WEIGHTS,
  calculateMomentumScore,
  calculateExecutionScore,
  calculateRecoveryScore,
  calculateDopamineProtectionScore,
  calculateSelfTrustScore,
  calculateLeverageRatio,
  calculateStrategicRatio,
  detectFakeProductivity,
  calculateShutdownQualityScoreValue,
  computeAllDailyMetrics,
};
