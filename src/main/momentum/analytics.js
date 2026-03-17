/**
 * Analytics Engine
 * Pattern detection, trend analysis, insight rules, and correlation detection.
 */

// ─── Trend Data ─────────────────────────────────────────────

function getTrendData(dailyLogs, metric, days = 30) {
  const entries = Object.values(dailyLogs)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days);
  return entries.map((log) => ({
    date: log.date,
    value: log[metric] ?? null,
  }));
}

function getMultiTrend(dailyLogs, metrics, days = 30) {
  const entries = Object.values(dailyLogs)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days);
  return entries.map((log) => {
    const point = { date: log.date };
    metrics.forEach((m) => { point[m] = log[m] ?? null; });
    return point;
  });
}

// ─── Averages ───────────────────────────────────────────────

function getAverage(dailyLogs, metric, days) {
  const entries = Object.values(dailyLogs)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(days ? -days : undefined)
    .filter((l) => l[metric] != null);
  if (entries.length === 0) return 0;
  const sum = entries.reduce((acc, l) => acc + (Number(l[metric]) || 0), 0);
  return Math.round((sum / entries.length) * 10) / 10;
}

function getWeeklyAverage(dailyLogs, metric) {
  return getAverage(dailyLogs, metric, 7);
}

function getMonthlyAverage(dailyLogs, metric) {
  return getAverage(dailyLogs, metric, 30);
}

// ─── Streaks ────────────────────────────────────────────────

function calculateStreaks(dailyLogs) {
  const sorted = Object.values(dailyLogs)
    .sort((a, b) => a.date.localeCompare(b.date));

  function streak(predicate) {
    let current = 0, best = 0;
    for (const log of sorted) {
      if (predicate(log)) {
        current++;
        best = Math.max(best, current);
      } else {
        current = 0;
      }
    }
    return { current, best };
  }

  return {
    wonDay: streak((l) => l.wonTheDay === true),
    workout: streak((l) => l.workoutCompleted === true),
    deepWork: streak((l) => (l.deepWorkHours || 0) >= 3),
    goodSleep: streak((l) => (l.sleepQuality || 0) >= 7),
    noCaffeineLate: streak((l) => l.lateCaffeineFlag !== true),
    lowScreenTime: streak((l) => (l.screenTimeMinutes || 0) <= 120),
    momentumAbove70: streak((l) => (l.momentumScore || 0) >= 70),
  };
}

// ─── Best / Worst Days ──────────────────────────────────────

function getBestWorstDays(dailyLogs, count = 5) {
  const sorted = Object.values(dailyLogs)
    .filter((l) => l.momentumScore != null)
    .sort((a, b) => b.momentumScore - a.momentumScore);
  return {
    best: sorted.slice(0, count),
    worst: sorted.slice(-count).reverse(),
  };
}

// ─── Category Breakdown ─────────────────────────────────────

function getCategoryBreakdown(tasks, dateRange) {
  const filtered = dateRange
    ? tasks.filter((t) => t.date >= dateRange.start && t.date <= dateRange.end)
    : tasks;

  const byPillar = {};
  const byWorkType = {};
  const byLeverage = {};

  filtered.forEach((t) => {
    if (t.completed) {
      byPillar[t.pillar] = (byPillar[t.pillar] || 0) + 1;
      byWorkType[t.workType] = (byWorkType[t.workType] || 0) + 1;
      byLeverage[t.leverage] = (byLeverage[t.leverage] || 0) + 1;
    }
  });

  return { byPillar, byWorkType, byLeverage };
}

// ─── Planned vs Completed ───────────────────────────────────

function getPlannedVsCompleted(tasks, days = 14) {
  const today = new Date();
  const results = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayTasks = tasks.filter((t) => t.date === dateStr);
    results.push({
      date: dateStr,
      planned: dayTasks.length,
      completed: dayTasks.filter((t) => t.completed).length,
    });
  }
  return results;
}

// ─── Habit Heatmap ──────────────────────────────────────────

function getHabitHeatmap(dailyLogs, metric, year, month) {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const entries = Object.values(dailyLogs).filter((l) => l.date.startsWith(prefix));
  return entries.map((l) => ({
    date: l.date,
    value: l[metric] ?? 0,
  }));
}

// ─── Correlations ───────────────────────────────────────────

function pearsonCorrelation(xs, ys) {
  const n = xs.length;
  if (n < 3) return 0;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

function getCorrelations(dailyLogs) {
  const logs = Object.values(dailyLogs).filter(
    (l) => l.momentumScore != null && l.sleepQuality != null
  );
  if (logs.length < 5) return [];

  const pairs = [
    { a: "lateCaffeineFlag", b: "sleepQuality", label: "Late caffeine vs sleep quality", invertA: true },
    { a: "workoutCompleted", b: "momentumScore", label: "Workout vs momentum", boolA: true },
    { a: "screenTimeMinutes", b: "momentumScore", label: "Screen time vs momentum" },
    { a: "deepWorkHours", b: "momentumScore", label: "Deep work vs momentum" },
    { a: "sleepQuality", b: "executionScore", label: "Sleep quality vs execution" },
    { a: "distractionMinutes", b: "dopamineProtectionScore", label: "Distraction vs dopamine protection" },
  ];

  return pairs.map(({ a, b, label, invertA, boolA }) => {
    const valid = logs.filter((l) => l[a] != null && l[b] != null);
    if (valid.length < 5) return null;
    const xs = valid.map((l) => {
      let v = boolA ? (l[a] ? 1 : 0) : Number(l[a]) || 0;
      return invertA ? (v ? 1 : 0) : v;
    });
    const ys = valid.map((l) => Number(l[b]) || 0);
    const r = pearsonCorrelation(xs, ys);
    return { label, correlation: Math.round(r * 100) / 100, samples: valid.length };
  }).filter(Boolean);
}

// ─── Insight Rules ──────────────────────────────────────────

function generateInsights(dailyLogs, tasks, targets) {
  const insights = [];
  const logs = Object.values(dailyLogs)
    .sort((a, b) => a.date.localeCompare(b.date));
  const recent = logs.slice(-7);

  if (recent.length < 3) return [{ type: "info", text: "Not enough data yet. Keep logging to unlock insights." }];

  // Late caffeine → poor sleep
  const lateCaffeineDays = recent.filter((l) => l.lateCaffeineFlag);
  if (lateCaffeineDays.length >= 2) {
    const avgSleepLate = lateCaffeineDays.reduce((s, l) => s + (l.sleepQuality || 0), 0) / lateCaffeineDays.length;
    const nonLate = recent.filter((l) => !l.lateCaffeineFlag);
    const avgSleepNormal = nonLate.length > 0
      ? nonLate.reduce((s, l) => s + (l.sleepQuality || 0), 0) / nonLate.length : 0;
    if (avgSleepLate < avgSleepNormal - 1) {
      insights.push({
        type: "warning",
        text: `Late caffeine is correlating with lower sleep quality (${avgSleepLate.toFixed(1)} vs ${avgSleepNormal.toFixed(1)}).`,
      });
    }
  }

  // Workout → focus
  const workoutDays = recent.filter((l) => l.workoutCompleted);
  const noWorkoutDays = recent.filter((l) => !l.workoutCompleted);
  if (workoutDays.length >= 2 && noWorkoutDays.length >= 2) {
    const avgFocusWorkout = workoutDays.reduce((s, l) => s + (l.deepWorkHours || 0), 0) / workoutDays.length;
    const avgFocusNo = noWorkoutDays.reduce((s, l) => s + (l.deepWorkHours || 0), 0) / noWorkoutDays.length;
    if (avgFocusWorkout > avgFocusNo + 0.5) {
      insights.push({
        type: "positive",
        text: `Workout days correlate with ${(avgFocusWorkout - avgFocusNo).toFixed(1)} more hours of deep work.`,
      });
    }
  }

  // Screen time → low momentum
  const avgScreen = recent.reduce((s, l) => s + (l.screenTimeMinutes || 0), 0) / recent.length;
  if (avgScreen > (targets.maxScreenTimeMinutes || 120) * 1.5) {
    insights.push({
      type: "warning",
      text: `Average screen time (${Math.round(avgScreen)} min) is well above your target. This correlates with lower momentum.`,
    });
  }

  // Late first productive block
  const fpbTimes = recent
    .filter((l) => l.firstProductiveBlockTime)
    .map((l) => {
      const [h, m] = l.firstProductiveBlockTime.split(":").map(Number);
      return h * 60 + (m || 0);
    });
  if (fpbTimes.length >= 3) {
    const avgFPB = fpbTimes.reduce((a, b) => a + b, 0) / fpbTimes.length;
    if (avgFPB > 10 * 60) { // after 10:00
      insights.push({
        type: "warning",
        text: `Your first productive block starts late (avg ${Math.floor(avgFPB / 60)}:${String(Math.round(avgFPB % 60)).padStart(2, "0")}). Earlier starts correlate with better execution.`,
      });
    }
  }

  // Overplanning → low self-trust
  const recentTasks = tasks.filter((t) => recent.some((l) => l.date === t.date));
  const avgPlanned = recent.length > 0 ? recentTasks.length / recent.length : 0;
  const avgSelfTrust = recent.reduce((s, l) => s + (l.selfTrustScore || 5), 0) / recent.length;
  if (avgPlanned > 8 && avgSelfTrust < 6) {
    insights.push({
      type: "warning",
      text: `You're planning ~${Math.round(avgPlanned)} tasks/day but self-trust is low (${avgSelfTrust.toFixed(1)}). Consider reducing planned load.`,
    });
  }

  // Declining momentum trend
  if (recent.length >= 5) {
    const firstHalf = recent.slice(0, 3);
    const secondHalf = recent.slice(-3);
    const avgFirst = firstHalf.reduce((s, l) => s + (l.momentumScore || 0), 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, l) => s + (l.momentumScore || 0), 0) / secondHalf.length;
    if (avgSecond < avgFirst - 10) {
      insights.push({
        type: "warning",
        text: `Momentum is declining (${Math.round(avgFirst)} → ${Math.round(avgSecond)}). Review what changed in the last few days.`,
      });
    } else if (avgSecond > avgFirst + 10) {
      insights.push({
        type: "positive",
        text: `Momentum is climbing (${Math.round(avgFirst)} → ${Math.round(avgSecond)}). Keep protecting what's working.`,
      });
    }
  }

  // Low leverage
  const completedRecent = recentTasks.filter((t) => t.completed);
  if (completedRecent.length >= 5) {
    const highLev = completedRecent.filter((t) => t.leverage === "High Leverage").length;
    if (highLev / completedRecent.length < 0.2) {
      insights.push({
        type: "warning",
        text: "Less than 20% of completed work was high leverage. You may be staying busy without moving the needle.",
      });
    }
  }

  return insights;
}

// ─── Discipline Break Pattern Analysis ──────────────────────

function analyzeDisciplineBreaks(dailyLogs) {
  const logs = Object.values(dailyLogs).filter((l) => l.brokeDisciplineReasons && l.brokeDisciplineReasons.length > 0);
  const counts = {};
  logs.forEach((l) => {
    l.brokeDisciplineReasons.forEach((reason) => {
      counts[reason] = (counts[reason] || 0) + 1;
    });
  });
  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => ({ reason, count, percentage: Math.round((count / logs.length) * 100) }));
  return sorted;
}

module.exports = {
  getTrendData,
  getMultiTrend,
  getAverage,
  getWeeklyAverage,
  getMonthlyAverage,
  calculateStreaks,
  getBestWorstDays,
  getCategoryBreakdown,
  getPlannedVsCompleted,
  getHabitHeatmap,
  getCorrelations,
  generateInsights,
  analyzeDisciplineBreaks,
};
