/**
 * LLM Prompt Templates
 *
 * Structured prompts for the performance advisor.
 * All prompts receive structured data and produce calm, precise analysis.
 *
 * Communication style: calm, concise, insightful, specific.
 * Never: hype, generic self-help, toxic productivity, "you got this!".
 */

const SYSTEM_PROMPT = `You are a performance analyst and executive coach. You speak with calm precision.
Your role: help the user understand their performance patterns and make better decisions.

Rules:
- Be specific and data-driven. Reference actual numbers from the data.
- Be concise. No filler. No motivational fluff.
- Identify root causes, not symptoms.
- When something went well, name exactly what and why.
- When something went wrong, explain the mechanism (e.g., "late caffeine → poor sleep → low morning focus").
- Never say "you got this" or "tomorrow is a new day" or similar platitudes.
- Frame corrections as strategic adjustments, not moral failures.
- Tone: calm coaching meets data analyst meets therapist-informed advisor.`;

function buildDailyReviewPrompt(dailyLog, tasks, outcomes, metrics, insights, targets) {
  const completedTasks = tasks.filter((t) => t.completed);
  const missedMustDos = tasks.filter((t) => t.priority === "Must Do" && !t.completed);
  const completedOutcomes = (outcomes || []).filter((o) => o.completed);
  const missedOutcomes = (outcomes || []).filter((o) => !o.completed);

  return {
    system: SYSTEM_PROMPT,
    user: `Analyze today's performance data and provide a daily review.

## Today's Data (${dailyLog.date})

**Momentum Score:** ${metrics.momentumScore}/100 | **Won the Day:** ${metrics.wonTheDay ? "Yes" : "No"}

**Sleep:** ${dailyLog.sleepHours || "?"}h, quality ${dailyLog.sleepQuality || "?"}/10, ${dailyLog.sleepStart || "?"} → ${dailyLog.sleepEnd || "?"}
**Deep Work:** ${dailyLog.deepWorkHours || 0}h (target: ${targets.deepWorkHours}h)
**Revenue Work:** ${dailyLog.revenueWorkHours || 0}h (target: ${targets.revenueWorkHours}h)
**Productive Hours:** ${dailyLog.productiveHours || 0}h
**First Productive Block:** ${dailyLog.firstProductiveBlockTime || "not logged"}
**Execution Quality:** ${dailyLog.executionQuality || "?"}/10

**Workout:** ${dailyLog.workoutCompleted ? `Yes (${dailyLog.workoutType || "?"}, ${dailyLog.workoutDuration || "?"}min)` : "No"}
**Energy:** ${dailyLog.energyLevel || "?"}/10

**Screen Time:** ${dailyLog.screenTimeMinutes || 0} min
**Distraction Time:** ${dailyLog.distractionMinutes || 0} min
**Caffeine:** ${dailyLog.caffeineTotalMg || 0}mg | Late caffeine: ${dailyLog.lateCaffeineFlag ? "Yes" : "No"}

**Mood Stability:** ${dailyLog.moodStability || "?"}/10
**Emotion Tags:** ${(dailyLog.emotionTags || []).join(", ") || "none"}
**Discipline Score:** ${dailyLog.disciplineScore || "?"}/10
${dailyLog.brokeDisciplineReasons?.length ? `**Discipline Broke Because:** ${dailyLog.brokeDisciplineReasons.join(", ")}` : ""}

**Tasks:** ${completedTasks.length}/${tasks.length} completed
**Must Dos Missed:** ${missedMustDos.map((t) => t.title).join(", ") || "none"}
**Critical Outcomes:** ${completedOutcomes.length}/${(outcomes || []).length} completed
${missedOutcomes.length ? `**Missed Outcomes:** ${missedOutcomes.map((o) => o.text).join(", ")}` : ""}

**Derived Metrics:**
- Execution Score: ${metrics.executionScore}
- Recovery Score: ${metrics.recoveryScore}
- Dopamine Protection: ${metrics.dopamineProtectionScore}
- Self-Trust: ${metrics.selfTrustScore}
- Leverage Ratio: ${(metrics.leverageRatio * 100).toFixed(0)}%
- Strategic Ratio: ${(metrics.strategicRatio * 100).toFixed(0)}%
${metrics.fakeProductivity?.isFakeProductivity ? `- **Fake Productivity Detected:** ${metrics.fakeProductivity.signals.join("; ")}` : ""}

${dailyLog.reflectionStrengthened ? `**Strengthened:** ${dailyLog.reflectionStrengthened}` : ""}
${dailyLog.reflectionWeakened ? `**Weakened:** ${dailyLog.reflectionWeakened}` : ""}
${dailyLog.reflectionAvoided ? `**Avoided:** ${dailyLog.reflectionAvoided}` : ""}

**Pattern Insights:** ${insights.map((i) => i.text).join(" | ") || "none yet"}

Provide:
1. A 2-3 sentence diagnosis of the day
2. What worked (be specific)
3. What didn't work and why (name the mechanism)
4. One concrete adjustment for tomorrow`,
  };
}

function buildTomorrowPlanPrompt(recentLogs, pendingTasks, targets, slipMode) {
  const recent = Object.values(recentLogs)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-3);

  const avgMomentum = recent.reduce((s, l) => s + (l.momentumScore || 0), 0) / (recent.length || 1);
  const avgSleep = recent.reduce((s, l) => s + (l.sleepHours || 0), 0) / (recent.length || 1);
  const avgDeepWork = recent.reduce((s, l) => s + (l.deepWorkHours || 0), 0) / (recent.length || 1);

  const unfinished = pendingTasks.filter((t) => !t.completed);
  const mustDos = unfinished.filter((t) => t.priority === "Must Do");
  const highLeverage = unfinished.filter((t) => t.leverage === "High Leverage");

  return {
    system: SYSTEM_PROMPT,
    user: `Generate a suggested plan for tomorrow based on recent data.

## Recent Performance (last ${recent.length} days)
- Avg Momentum: ${avgMomentum.toFixed(0)}
- Avg Sleep: ${avgSleep.toFixed(1)}h
- Avg Deep Work: ${avgDeepWork.toFixed(1)}h
- Last day emotion tags: ${recent[recent.length - 1]?.emotionTags?.join(", ") || "none"}
${slipMode?.active ? "- **SLIP MODE ACTIVE** — user needs recovery structure" : ""}

## Unfinished Tasks
Must Do: ${mustDos.map((t) => t.title).join(", ") || "none"}
High Leverage: ${highLeverage.map((t) => t.title).join(", ") || "none"}
Other: ${unfinished.filter((t) => t.priority !== "Must Do" && t.leverage !== "High Leverage").length} remaining tasks

## Targets
- Deep Work: ${targets.deepWorkHours}h
- Revenue Work: ${targets.revenueWorkHours}h
- Sleep: ${targets.sleepHours}h
- Caffeine cutoff: ${targets.caffeineCutoffTime}

Provide:
1. Top 1-3 critical outcomes for tomorrow
2. Suggested task priority order
3. Recommended deep work start time
4. One thing to protect
5. One thing to avoid`,
  };
}

function buildWeeklyReportPrompt(weekData) {
  return {
    system: SYSTEM_PROMPT,
    user: `Generate a weekly executive summary.

## Week: ${weekData.startDate} to ${weekData.endDate}

**Scores:**
- Avg Momentum: ${weekData.avgMomentum}
- Days Won: ${weekData.daysWon}/${weekData.totalDays}
- Avg Sleep: ${weekData.avgSleep}h (quality: ${weekData.avgSleepQuality}/10)
- Avg Deep Work: ${weekData.avgDeepWork}h
- Avg Revenue Work: ${weekData.avgRevenueWork}h
- Avg Screen Time: ${weekData.avgScreenTime} min
- Workouts: ${weekData.workoutDays}/${weekData.totalDays}

**Task Performance:**
- Total planned: ${weekData.totalTasksPlanned}
- Total completed: ${weekData.totalTasksCompleted}
- Must Dos completed: ${weekData.mustDosCompleted}/${weekData.mustDosPlanned}
- Critical outcomes hit: ${weekData.criticalOutcomesCompleted}/${weekData.criticalOutcomesPlanned}

**Patterns:**
- Leverage ratio: ${(weekData.leverageRatio * 100).toFixed(0)}%
- Fake productivity days: ${weekData.fakeProductivityDays}
- Late caffeine days: ${weekData.lateCaffeineDays}
- Top discipline break reasons: ${weekData.topDisciplineBreaks?.join(", ") || "none"}

**Streaks:** ${weekData.currentStreaks || "none active"}
**Insights:** ${weekData.insights?.map((i) => i.text).join(" | ") || "none"}

Generate a weekly report with exactly 4 sections:
1. **Executive Summary** (3-4 sentences: overall momentum, real vs fake progress, top bottleneck)
2. **Behavioral Patterns** (sleep, caffeine, screen time, mood, workout observations)
3. **Performance Summary** (deep work, revenue work, leverage, self-trust, execution)
4. **Next Week Plan** (3 specific changes, 1 habit to protect, 1 thing to cut, 1 priority to front-load)`,
  };
}

function buildSlipModePrompt(slipData, resetPlan) {
  return {
    system: SYSTEM_PROMPT,
    user: `The user has entered slip mode. Provide calm, specific recovery guidance.

## Slip Detection
Triggers: ${slipData.triggers.join("; ")}
Risk Score: ${slipData.score}/100

## Reset Plan Generated
${resetPlan.recommendations.map((r) => `- ${r.category}: ${r.action}`).join("\n")}

Provide:
1. A calm 2-sentence acknowledgment of what's happening (not shame, not dismissal)
2. The most likely root cause based on the triggers
3. The single most important thing to do in the next 4 hours
4. What to protect tonight for tomorrow's recovery`,
  };
}

module.exports = {
  SYSTEM_PROMPT,
  buildDailyReviewPrompt,
  buildTomorrowPlanPrompt,
  buildWeeklyReportPrompt,
  buildSlipModePrompt,
};
