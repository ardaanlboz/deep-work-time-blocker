const { randomUUID } = require("crypto");
const { getConfig, setConfig } = require("./config");

function createEmptyMetrics() {
  return {
    startedAt: null,
    blockedSiteHits: 0,
    reminderPopupsShown: 0,
    appsWarned: 0,
    appsClosed: 0,
    appsForceKilled: 0,
    appsClosedNames: new Set(),
  };
}

function finalizeAndPersist(metrics, endedAt) {
  const startedAt = metrics.startedAt ? new Date(metrics.startedAt) : null;
  const endDate = new Date(endedAt);
  const durationSeconds = startedAt ? Math.max(0, Math.floor((endDate - startedAt) / 1000)) : 0;

  const report = {
    id: randomUUID(),
    startedAt: metrics.startedAt || endDate.toISOString(),
    endedAt: endDate.toISOString(),
    durationSeconds,
    blockedSiteHits: metrics.blockedSiteHits,
    reminderPopupsShown: metrics.reminderPopupsShown,
    appsWarned: metrics.appsWarned,
    appsClosed: metrics.appsClosed,
    appsForceKilled: metrics.appsForceKilled,
    appsClosedNames: Array.from(metrics.appsClosedNames),
  };

  const config = getConfig();
  const existing = config.activityReports || [];
  const next = [report, ...existing].slice(0, 50);
  setConfig({ activityReports: next });
  return report;
}

module.exports = {
  createEmptyMetrics,
  finalizeAndPersist,
};
