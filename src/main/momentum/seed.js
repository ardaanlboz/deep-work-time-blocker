/**
 * Seed Data Generator
 * Creates 30 days of realistic sample data for development.
 */

const { uid } = require("./store");

const EMOTION_TAGS = ["grounded", "sharp", "driven", "calm", "restless", "overwhelmed", "discouraged", "numb", "scattered"];
const WORKOUT_TYPES = ["strength", "cardio", "yoga", "walk", "HIIT", "swimming"];
const WORK_TYPES = ["Deep Work", "Revenue Work", "Tactical Work", "Admin", "Recovery", "Personal", "Health", "School"];
const PILLARS = ["Revenue", "Product", "Content", "School", "Health", "Admin", "Personal"];
const PRIORITIES = ["Must Do", "Should Do", "Nice to Do", "Delegate"];
const LEVERAGES = ["High Leverage", "Medium Leverage", "Low Leverage"];
const DISCIPLINE_REASONS = ["tired", "overstimulated", "anxious", "unclear priorities", "emotionally off", "environment distracted me", "avoiding hard task", "unrealistic plan", "poor sleep"];

function rand(min, max) {
  return Math.random() * (max - min) + min;
}
function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}
function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}
function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function generateDayData(dateStr, dayIndex) {
  // Create natural variation with some bad days
  const isGoodDay = Math.random() > 0.3;
  const isBadDay = !isGoodDay && Math.random() > 0.5;
  const baseQuality = isBadDay ? 0.4 : isGoodDay ? 0.8 : 0.6;

  const sleepHours = Math.round((rand(5.5, 9) * baseQuality + rand(5.5, 9) * (1 - baseQuality)) * 10) / 10;
  const sleepQuality = Math.min(10, Math.max(1, Math.round(sleepHours * 1.2 + rand(-1, 1))));
  const sleepStartHour = randInt(22, 24);
  const sleepStart = `${sleepStartHour > 23 ? "00" : sleepStartHour}:${randInt(0, 5) * 10}`.padStart(5, "0");
  const sleepEndHour = Math.round(sleepStartHour + sleepHours) % 24;
  const sleepEnd = `${String(sleepEndHour).padStart(2, "0")}:${randInt(0, 5) * 10}`.padStart(5, "0");

  const deepWorkHours = Math.round(rand(isGoodDay ? 2.5 : 0.5, isGoodDay ? 5.5 : 3) * 10) / 10;
  const revenueWorkHours = Math.round(rand(isGoodDay ? 1.5 : 0, isGoodDay ? 4 : 2) * 10) / 10;
  const productiveHours = Math.round((deepWorkHours + revenueWorkHours + rand(0.5, 2)) * 10) / 10;
  const firstProductiveHour = isGoodDay ? randInt(7, 9) : randInt(9, 12);
  const firstProductiveBlockTime = `${String(firstProductiveHour).padStart(2, "0")}:${randInt(0, 5) * 10}`.padStart(5, "0");

  const workoutCompleted = isGoodDay ? Math.random() > 0.2 : Math.random() > 0.6;
  const workoutType = workoutCompleted ? pick(WORKOUT_TYPES) : null;
  const workoutDuration = workoutCompleted ? randInt(20, 75) : 0;
  const energyLevel = Math.min(10, Math.max(1, Math.round(baseQuality * 10 + rand(-2, 2))));

  const screenTimeMinutes = Math.round(isBadDay ? rand(150, 300) : isGoodDay ? rand(30, 120) : rand(90, 200));
  const distractionMinutes = Math.round(screenTimeMinutes * rand(0.2, 0.6));
  const caffeineTotalMg = randInt(0, 4) * 100;
  const caffeineEntryCount = Math.ceil(caffeineTotalMg / 100);
  const caffeineEntries = [];
  const lateCaffeineFlag = isBadDay && Math.random() > 0.4;
  for (let i = 0; i < caffeineEntryCount; i++) {
    const hour = lateCaffeineFlag && i === caffeineEntryCount - 1
      ? randInt(15, 18)
      : randInt(6, 13);
    caffeineEntries.push({
      time: `${String(hour).padStart(2, "0")}:${randInt(0, 5) * 10}`.padStart(5, "0"),
      mg: 100,
    });
  }

  const executionQuality = Math.min(10, Math.max(1, Math.round(baseQuality * 10 + rand(-1.5, 1.5))));
  const disciplineScore = Math.min(10, Math.max(1, Math.round(baseQuality * 10 + rand(-2, 2))));
  const moodStability = Math.min(10, Math.max(1, Math.round(baseQuality * 9 + rand(-1, 2))));
  const selfTrustScore = Math.min(10, Math.max(1, Math.round(baseQuality * 10 + rand(-2, 1))));
  const shutdownQualityScore = Math.min(10, Math.max(1, Math.round(baseQuality * 9 + rand(-1, 2))));

  const emotionTags = isGoodDay
    ? pickN(["grounded", "sharp", "driven", "calm"], randInt(1, 3))
    : isBadDay
      ? pickN(["restless", "overwhelmed", "discouraged", "scattered"], randInt(1, 3))
      : pickN(EMOTION_TAGS, randInt(1, 2));

  const brokeDisciplineReasons = isBadDay
    ? pickN(DISCIPLINE_REASONS, randInt(1, 3))
    : !isGoodDay && Math.random() > 0.5
      ? pickN(DISCIPLINE_REASONS, 1)
      : [];

  return {
    date: dateStr,
    sleepHours,
    sleepQuality,
    sleepStart,
    sleepEnd,
    deepWorkHours,
    productiveHours,
    revenueWorkHours,
    firstProductiveBlockTime,
    executionQuality,
    fakeProductivityFlag: false,
    selfTrustScore,
    workoutCompleted,
    workoutType,
    workoutDuration,
    energyLevel,
    screenTimeMinutes,
    distractionMinutes,
    caffeineTotalMg,
    caffeineEntries,
    lateCaffeineFlag,
    disciplineScore,
    moodStability,
    emotionTags,
    shutdownQualityScore,
    brokeDisciplineReasons,
    reflectionStrengthened: isGoodDay ? "Stayed on deep work through the morning block." : "",
    reflectionWeakened: isBadDay ? "Got pulled into reactive tasks after lunch." : "",
    reflectionAvoided: isBadDay ? "The hard revenue task I've been putting off." : "",
    reflectionMattered: isGoodDay ? "Closed the key deliverable." : "",
    reflectionTomorrow: "Protect the first 2 hours.",
  };
}

function generateTasks(dateStr, isGoodDay) {
  const taskCount = randInt(3, 8);
  const tasks = [];
  for (let i = 0; i < taskCount; i++) {
    const priority = i === 0 ? "Must Do" : i === 1 ? "Must Do" : pick(PRIORITIES);
    const workType = pick(WORK_TYPES);
    const isCritical = i < 2 && Math.random() > 0.5;
    const completed = priority === "Must Do"
      ? (isGoodDay ? Math.random() > 0.15 : Math.random() > 0.5)
      : Math.random() > 0.35;

    tasks.push({
      id: uid(),
      title: generateTaskTitle(workType, i),
      date: dateStr,
      completed,
      priority,
      workType,
      pillar: pick(PILLARS),
      leverage: i < 2 ? "High Leverage" : pick(LEVERAGES),
      estimatedDuration: pick([15, 30, 45, 60, 90, 120]),
      actualDuration: completed ? pick([15, 30, 45, 60, 90, 120]) : null,
      notes: "",
      countsAsDeepWork: ["Deep Work"].includes(workType),
      countsAsRevenueWork: ["Revenue Work"].includes(workType),
      isCriticalOutcome: isCritical,
      order: i,
      createdAt: new Date().toISOString(),
    });
  }
  return tasks;
}

function generateTaskTitle(workType, index) {
  const titles = {
    "Deep Work": ["Write product spec", "Build feature module", "Design system architecture", "Research market data", "Code review deep dive"],
    "Revenue Work": ["Client outreach batch", "Proposal draft", "Sales follow-ups", "Pricing strategy work", "Partnership call prep"],
    "Tactical Work": ["Process emails", "Update project board", "Fix minor bugs", "Organize documents", "Team standup notes"],
    "Admin": ["Invoice processing", "Calendar cleanup", "Tool subscriptions review", "File organization", "Meeting prep"],
    "Recovery": ["Walk break", "Meditation", "Reading", "Journaling", "Nap"],
    "Personal": ["Grocery run", "Apartment cleanup", "Call family", "Cook dinner", "Errands"],
    "Health": ["Gym session", "Meal prep", "Doctor appointment", "Stretching routine", "Supplement restock"],
    "School": ["Study session", "Assignment work", "Lecture review", "Group project", "Reading assignment"],
  };
  const list = titles[workType] || titles["Tactical Work"];
  return list[index % list.length];
}

function generateCriticalOutcomes(dateStr, isGoodDay) {
  const count = randInt(1, 3);
  const outcomes = [];
  const titles = [
    "Ship the landing page update",
    "Close revenue milestone",
    "Finish product spec draft",
    "Complete client deliverable",
    "Record content batch",
    "Submit assignment",
    "Finalize pricing model",
  ];
  for (let i = 0; i < count; i++) {
    outcomes.push({
      id: uid(),
      text: titles[randInt(0, titles.length - 1)],
      completed: isGoodDay ? Math.random() > 0.25 : Math.random() > 0.6,
    });
  }
  return outcomes;
}

function generateSeedData() {
  const dailyLogs = {};
  const allTasks = [];
  const criticalOutcomes = {};
  const today = new Date();

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const isGoodDay = Math.random() > 0.3;

    const log = generateDayData(dateStr, 30 - i);
    dailyLogs[dateStr] = log;

    const tasks = generateTasks(dateStr, isGoodDay);
    allTasks.push(...tasks);

    criticalOutcomes[dateStr] = generateCriticalOutcomes(dateStr, isGoodDay);
  }

  return { dailyLogs, tasks: allTasks, criticalOutcomes };
}

module.exports = { generateSeedData };
