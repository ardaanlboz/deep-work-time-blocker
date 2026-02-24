const fs = require("fs");
const path = require("path");
const { app, Notification } = require("electron");
const { getConfig, setConfig, toBlockVariants } = require("./config");
const { enforceBlockedApps, enforceAllowOnlyApps } = require("./appBlocker");
const { terminateAppByName, listRunningForegroundApps, buildAllowedAppSet } = require("./appBlocker");
const { getActiveBrowserHostname } = require("./browserWatcher");
const {
  applyHostsBlock,
  removeHostsBlock,
  startBlockHitWatcher,
  stopBlockHitWatcher,
} = require("./hostsManager");
const { showReminderPopup, closeReminderPopup } = require("./reminderWindow");
const { logInfo, logWarn, logError } = require("./logger");
const { createEmptyMetrics, finalizeAndPersist } = require("./activityReport");
const { finalizeDraftIfAny } = require("./notesManager");

let countdownIntervalId = null;
let hitPollIntervalId = null;
let appBlockIntervalId = null;
let hitLogPath = null;
let hitLogReadOffset = 0;
let lastPopupAtMs = 0;
let browserPollIntervalId = null;
let lastBrowserHost = null;
let endAtMs = null;
let statusListener = null;
let recoveryRequired = false;
let transitionState = "idle";
let metrics = createEmptyMetrics();
let pendingAppCloses = new Map(); // appName -> firstSeenAtMs

function getStopLockRemainingSeconds(config) {
  if (!config.lastSession.active || !config.lastSession.startAt) {
    return 0;
  }
  const startAtMs = Date.parse(config.lastSession.startAt);
  if (!Number.isFinite(startAtMs)) {
    return 0;
  }
  const lockSeconds = Math.max(0, Number(config.lockStopMinutes || 0) * 60);
  const elapsedSeconds = Math.floor((Date.now() - startAtMs) / 1000);
  return Math.max(0, lockSeconds - elapsedSeconds);
}

function emitStatus() {
  if (typeof statusListener === "function") {
    statusListener(getSessionStatus());
  }
}

function clearTimers() {
  if (countdownIntervalId) {
    clearInterval(countdownIntervalId);
    countdownIntervalId = null;
  }
  if (hitPollIntervalId) {
    clearInterval(hitPollIntervalId);
    hitPollIntervalId = null;
  }
  if (appBlockIntervalId) {
    clearInterval(appBlockIntervalId);
    appBlockIntervalId = null;
  }
  if (browserPollIntervalId) {
    clearInterval(browserPollIntervalId);
    browserPollIntervalId = null;
  }
  pendingAppCloses = new Map();
}

function setStatusListener(listener) {
  statusListener = listener;
}

function getSessionStatus() {
  const config = getConfig();
  const active = Boolean(config.lastSession.active);
  const stopLockRemainingSeconds = getStopLockRemainingSeconds(config);
  const remainingSeconds =
    active && endAtMs ? Math.max(0, Math.floor((endAtMs - Date.now()) / 1000)) : 0;

  return {
    active,
    strictMode: config.strictMode,
    sessionMinutes: config.sessionMinutes,
    lockStopMinutes: config.lockStopMinutes,
    blockedDomains: config.blockedDomains,
    blockedApps: config.blockedApps || [],
    allowedApps: config.allowedApps || [],
    allowOnlySelectedApps: Boolean(config.allowOnlySelectedApps),
    videoUrl: config.videoUrl,
    recoveryRequired,
    remainingSeconds,
    stopLocked: active && stopLockRemainingSeconds > 0,
    stopLockRemainingSeconds,
    startAt: config.lastSession.startAt || null,
    endAt: config.lastSession.endAt || null,
    sessionNumber: config.lastSession.sessionNumber || null,
  };
}

function scheduleTimers() {
  countdownIntervalId = setInterval(async () => {
    emitStatus();
    if (endAtMs && Date.now() >= endAtMs) {
      try {
        logInfo("Session reached scheduled end time");
        await stopSession({ reason: "duration-complete", internal: true });
      } catch (error) {
        logError("Failed to stop session at scheduled end", { error: error.message });
      }
    }
  }, 1000);
}

function startBlockHitMonitor() {
  if (!hitLogPath) {
    return;
  }
  hitPollIntervalId = setInterval(() => {
    try {
      if (!fs.existsSync(hitLogPath)) {
        return;
      }
      const stat = fs.statSync(hitLogPath);
      if (stat.size <= hitLogReadOffset) {
        return;
      }
      const fd = fs.openSync(hitLogPath, "r");
      const length = stat.size - hitLogReadOffset;
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, hitLogReadOffset);
      fs.closeSync(fd);
      hitLogReadOffset = stat.size;
      const chunk = buffer.toString("utf8").trim();
      if (!chunk) {
        return;
      }
      const now = Date.now();
      // Avoid spawning many reminder popups from asset retries in browsers.
      if (now - lastPopupAtMs < 4000) {
        return;
      }
      lastPopupAtMs = now;
      const config = getConfig();
      showReminderPopup(config.videoUrl);
      metrics.blockedSiteHits += 1;
      metrics.reminderPopupsShown += 1;
      logInfo("Blocked-site hit detected; reminder popup shown");
    } catch (error) {
      logError("Failed while reading block hit log", { error: error.message });
    }
  }, 1000);
}

function startBrowserBlockedSiteMonitor() {
  browserPollIntervalId = setInterval(async () => {
    try {
      const config = getConfig();
      const blocked = new Set((config.blockedDomains || []).map((d) => String(d).toLowerCase()));
      if (blocked.size === 0) {
        return;
      }
      const info = await getActiveBrowserHostname();
      if (!info) {
        lastBrowserHost = null;
        return;
      }
      if (info.host === lastBrowserHost) {
        return;
      }
      lastBrowserHost = info.host;
      if (!blocked.has(info.host)) {
        return;
      }

      const now = Date.now();
      if (now - lastPopupAtMs < 4000) {
        return;
      }
      lastPopupAtMs = now;
      showReminderPopup(config.videoUrl);
      metrics.blockedSiteHits += 1;
      metrics.reminderPopupsShown += 1;
      logInfo("Browser URL blocked-site hit detected; reminder popup shown", info);
    } catch (error) {
      logError("Browser blocked-site monitor failed", { error: error.message });
    }
  }, 1500);
}

async function enforceAllowOnlyWithSoftWarning(config) {
  const allowed = buildAllowedAppSet(config.allowedApps, [app.name]);
  const running = await listRunningForegroundApps();
  const disallowed = running.filter((name) => !allowed.has(name));
  const now = Date.now();
  const warnMs = Math.max(0, Number(config.appCloseWarningSeconds || 0) * 1000);

  // Clear resolved entries.
  for (const key of Array.from(pendingAppCloses.keys())) {
    if (!disallowed.includes(key)) {
      pendingAppCloses.delete(key);
    }
  }

  for (const appName of disallowed) {
    const firstSeen = pendingAppCloses.get(appName);
    if (!firstSeen) {
      pendingAppCloses.set(appName, now);
      metrics.appsWarned += 1;
      try {
        if (Notification.isSupported()) {
          new Notification({
            title: "DeepWork",
            body: `Closing ${appName} in ${Math.ceil(warnMs / 1000)}s (not in allowlist)`,
          }).show();
        }
      } catch (_error) {}
      continue;
    }

    if (warnMs === 0 || now - firstSeen >= warnMs) {
      await terminateAppByName(appName);
      metrics.appsClosed += 1;
      metrics.appsForceKilled += 1; // terminateAppByName includes pkill fallback
      metrics.appsClosedNames.add(appName);
      pendingAppCloses.delete(appName);
    }
  }
}

function startAppBlockMonitor() {
  appBlockIntervalId = setInterval(async () => {
    try {
      const config = getConfig();
      if (config.allowOnlySelectedApps) {
        await enforceAllowOnlyWithSoftWarning(config);
      } else {
        await enforceBlockedApps(config.blockedApps);
      }
    } catch (error) {
      logError("Blocked app monitor cycle failed", { error: error.message });
    }
  }, 3000);
}

async function startSession() {
  if (transitionState !== "idle") {
    throw new Error("Please wait. Session transition is already in progress.");
  }
  transitionState = "starting";
  const config = getConfig();
  try {
    if (config.allowOnlySelectedApps && (!config.allowedApps || config.allowedApps.length === 0)) {
      throw new Error("Allow-only apps mode is enabled but no allowed apps are selected.");
    }
    if (config.lastSession.active) {
      throw new Error("A deep work session is already active.");
    }

    const domains = Array.from(
      new Set(config.blockedDomains.flatMap((domain) => toBlockVariants(domain)))
    );
    hitLogPath = path.join(app.getPath("userData"), "blocked-hits.log");
    fs.mkdirSync(path.dirname(hitLogPath), { recursive: true });
    fs.writeFileSync(hitLogPath, "", "utf8");
    hitLogReadOffset = 0;
    lastPopupAtMs = 0;
    try {
      await startBlockHitWatcher(hitLogPath);
    } catch (error) {
      // Fallback: still allow session start and detect hits via browser URL polling.
      logWarn("Block hit watcher failed; using browser URL fallback", { error: error.message });
      hitLogPath = null;
    }
    try {
      await applyHostsBlock(domains);
      if (config.allowOnlySelectedApps) {
        await enforceAllowOnlyWithSoftWarning(config);
      } else {
        await enforceBlockedApps(config.blockedApps);
      }
    } catch (error) {
      await stopBlockHitWatcher().catch(() => {});
      throw error;
    }

    const startAt = new Date();
    const nextSessionNumber = (getConfig().sessionCounter || 0) + 1;
    const endAt = new Date(startAt.getTime() + config.sessionMinutes * 60 * 1000);
    endAtMs = endAt.getTime();
    metrics = createEmptyMetrics();
    metrics.startedAt = startAt.toISOString();
    pendingAppCloses = new Map();

    setConfig({
      sessionCounter: nextSessionNumber,
      currentSessionNoteDraft: "",
      lastSession: {
        active: true,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        sessionNumber: nextSessionNumber,
      },
    });

    scheduleTimers();
    startBlockHitMonitor();
    startBrowserBlockedSiteMonitor();
    startAppBlockMonitor();
    recoveryRequired = false;
    emitStatus();

    if (!config.videoUrl) {
      logWarn("Session started with empty reminder video URL");
    }
    logInfo("Session started", {
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      blockCount: domains.length,
    });

    return getSessionStatus();
  } finally {
    transitionState = "idle";
  }
}

async function stopSession(options = {}) {
  if (transitionState !== "idle") {
    throw new Error("Please wait. Session transition is already in progress.");
  }
  transitionState = "stopping";
  const config = getConfig();
  try {
    if (!config.lastSession.active && !options.force) {
      return getSessionStatus();
    }
    const stopLockRemainingSeconds = getStopLockRemainingSeconds(config);
    if (!options.force && !options.internal && stopLockRemainingSeconds > 0) {
      throw new Error(
        `Stop is locked for the first ${config.lockStopMinutes} minute(s). Try again in ${Math.ceil(
          stopLockRemainingSeconds / 60
        )} minute(s).`
      );
    }

    clearTimers();
    closeReminderPopup();
    endAtMs = null;

    try {
      await stopBlockHitWatcher().catch(() => {});
      await removeHostsBlock();
    } catch (error) {
      logError("Stop session could not remove hosts section", { error: error.message });
      throw error;
    }

    setConfig({
      lastSession: {
        active: false,
        startAt: config.lastSession.startAt,
        endAt: new Date().toISOString(),
        sessionNumber: config.lastSession.sessionNumber,
      },
    });

    finalizeAndPersist(metrics, new Date().toISOString());
    finalizeDraftIfAny();

    recoveryRequired = false;
    emitStatus();
    logInfo("Session stopped", { reason: options.reason || "user" });
    return getSessionStatus();
  } finally {
    transitionState = "idle";
  }
}

function resumeOrRecoverIfNeeded() {
  const config = getConfig();
  recoveryRequired = Boolean(config.lastSession.active);
  if (recoveryRequired) {
    logWarn("Previous active session detected; recovery required");
  }
  emitStatus();
  return getSessionStatus();
}

function clearRecoveryFlag() {
  recoveryRequired = false;
  emitStatus();
}

function beforeQuitCleanup() {
  const config = getConfig();
  if (!config.lastSession.active) {
    return;
  }
  if (config.strictMode) {
    logInfo("Strict mode enabled; skipping auto cleanup on quit");
    return;
  }

  Promise.allSettled([stopBlockHitWatcher(), removeHostsBlock()])
    .then(() => {
      setConfig({
        lastSession: {
          active: false,
          startAt: config.lastSession.startAt,
          endAt: new Date().toISOString(),
        },
      });
      logInfo("Best-effort cleanup done on before-quit");
    })
    .catch((error) => {
      logError("Best-effort before-quit cleanup failed", { error: error.message });
    });
}

module.exports = {
  setStatusListener,
  getSessionStatus,
  startSession,
  stopSession,
  resumeOrRecoverIfNeeded,
  clearRecoveryFlag,
  beforeQuitCleanup,
};
