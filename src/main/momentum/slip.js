/**
 * Slip Detection Engine
 *
 * Detects when user is entering a decline pattern and triggers
 * structured recovery mode.
 *
 * Triggers:
 * - 3+ consecutive days with momentum < 55
 * - Rising screen time over 3+ days
 * - Falling deep work over 3+ days
 * - 3+ days of missed Must Do tasks
 * - Worsening sleep + late caffeine pattern
 */

function detectSlipRisk(dailyLogs, tasks) {
  const sorted = Object.values(dailyLogs)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7);

  if (sorted.length < 3) return { isSlipping: false, risk: "low", triggers: [], score: 0 };

  const recent3 = sorted.slice(-3);
  const triggers = [];
  let riskScore = 0;

  // Low momentum streak
  const lowMomentumDays = recent3.filter((l) => (l.momentumScore || 0) < 55);
  if (lowMomentumDays.length >= 3) {
    triggers.push("3+ consecutive low momentum days (below 55)");
    riskScore += 30;
  } else if (lowMomentumDays.length >= 2) {
    riskScore += 15;
  }

  // Rising screen time
  if (recent3.length >= 3) {
    const screens = recent3.map((l) => l.screenTimeMinutes || 0);
    if (screens[2] > screens[1] && screens[1] > screens[0] && screens[2] > 150) {
      triggers.push("Screen time rising over last 3 days");
      riskScore += 20;
    }
  }

  // Falling deep work
  if (recent3.length >= 3) {
    const dw = recent3.map((l) => l.deepWorkHours || 0);
    if (dw[2] < dw[1] && dw[1] < dw[0] && dw[2] < 2) {
      triggers.push("Deep work declining over last 3 days");
      riskScore += 20;
    }
  }

  // Missed must-dos
  const recentDates = new Set(recent3.map((l) => l.date));
  const recentTasks = tasks.filter((t) => recentDates.has(t.date));
  const mustDosByDay = {};
  recentTasks.forEach((t) => {
    if (t.priority === "Must Do") {
      if (!mustDosByDay[t.date]) mustDosByDay[t.date] = { total: 0, missed: 0 };
      mustDosByDay[t.date].total++;
      if (!t.completed) mustDosByDay[t.date].missed++;
    }
  });
  const daysWithMissedMustDos = Object.values(mustDosByDay).filter((d) => d.missed > 0).length;
  if (daysWithMissedMustDos >= 3) {
    triggers.push("Repeated missed Must Do tasks (3+ days)");
    riskScore += 25;
  }

  // Sleep + caffeine pattern
  const lateCaffeineDays = recent3.filter((l) => l.lateCaffeineFlag).length;
  const poorSleepDays = recent3.filter((l) => (l.sleepQuality || 10) < 5).length;
  if (lateCaffeineDays >= 2 && poorSleepDays >= 2) {
    triggers.push("Late caffeine + poor sleep pattern detected");
    riskScore += 20;
  }

  // No workouts
  const noWorkout = recent3.filter((l) => !l.workoutCompleted).length;
  if (noWorkout >= 3) {
    triggers.push("No workouts in last 3 days");
    riskScore += 10;
  }

  const risk = riskScore >= 50 ? "high" : riskScore >= 30 ? "medium" : "low";
  const isSlipping = risk === "high";

  return { isSlipping, risk, triggers, score: Math.min(riskScore, 100) };
}

function generateResetPlan(dailyLogs, tasks, targets) {
  const slip = detectSlipRisk(dailyLogs, tasks);
  if (!slip.isSlipping) return null;

  const sorted = Object.values(dailyLogs)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-3);

  const avgSleep = sorted.reduce((s, l) => s + (l.sleepHours || 0), 0) / sorted.length;
  const avgScreen = sorted.reduce((s, l) => s + (l.screenTimeMinutes || 0), 0) / sorted.length;
  const avgDeepWork = sorted.reduce((s, l) => s + (l.deepWorkHours || 0), 0) / sorted.length;

  const plan = {
    duration: "24 hours",
    triggers: slip.triggers,
    recommendations: [],
  };

  // Always recommend reduced load
  plan.recommendations.push({
    category: "Task Load",
    action: "Limit to 3 Must Do tasks maximum. No Should Do pressure.",
  });

  // Deep work
  plan.recommendations.push({
    category: "Deep Work",
    action: `Target ${Math.min(avgDeepWork + 1, targets.deepWorkHours || 4).toFixed(1)} hours. Start within 90 minutes of waking.`,
  });

  // Screen time
  if (avgScreen > 120) {
    plan.recommendations.push({
      category: "Screen Time",
      action: `Reduce to ${Math.max(avgScreen - 60, 60)} minutes. No screens after 9 PM.`,
    });
  }

  // Sleep
  if (avgSleep < 7) {
    plan.recommendations.push({
      category: "Sleep",
      action: "Prioritize 7.5+ hours tonight. Bed by 11 PM.",
    });
  }

  // Caffeine
  if (slip.triggers.some((t) => t.includes("caffeine"))) {
    plan.recommendations.push({
      category: "Caffeine",
      action: `Hard cutoff at ${targets.caffeineCutoffTime || "14:00"}. Max ${targets.maxCaffeineMg || 300}mg total.`,
    });
  }

  // Workout
  if (slip.triggers.some((t) => t.includes("workout"))) {
    plan.recommendations.push({
      category: "Workout",
      action: "Even a 20-minute walk counts. Move your body today.",
    });
  }

  // Dopamine
  plan.recommendations.push({
    category: "Dopamine Protection",
    action: "No social media. No mindless browsing. Protect morning focus.",
  });

  return plan;
}

module.exports = {
  detectSlipRisk,
  generateResetPlan,
};
