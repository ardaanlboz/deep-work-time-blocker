const path = require("path");
const { execFile } = require("child_process");
const { logInfo, logWarn } = require("./logger");

const ALWAYS_ALLOWED_APPS = new Set([
  "DeepWork",
  "Electron",
  "Finder",
  "Dock",
  "SystemUIServer",
  "ControlCenter",
  "NotificationCenter",
  "WindowManager",
  "loginwindow",
  "Spotlight",
  "SecurityAgent",
]);

function normalizeAppName(input) {
  const raw = String(input || "").trim();
  if (!raw) {
    return null;
  }
  const base = path.basename(raw).replace(/\.app$/i, "").trim();
  if (!base) {
    return null;
  }
  return base;
}

function runCmd(command, args) {
  return new Promise((resolve) => {
    execFile(command, args, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        stdout: String(stdout || ""),
        stderr: String(stderr || ""),
      });
    });
  });
}

function quoteForBash(value) {
  return String(value).replace(/'/g, `'\\''`);
}

async function terminateAppByName(appName) {
  const normalized = normalizeAppName(appName);
  if (!normalized) {
    return;
  }

  // Try graceful quit first.
  await runCmd("osascript", ["-e", `tell application "${normalized}" to quit`]);

  // Then force terminate by exact process name and by bundle executable path pattern.
  await runCmd("pkill", ["-x", normalized]);
  await runCmd("bash", [
    "-lc",
    `pkill -f '/${quoteForBash(normalized)}.app/Contents/MacOS/' || true`,
  ]);
}

async function listRunningForegroundApps() {
  const script = `
tell application "System Events"
  set procNames to name of (application processes where background only is false)
end tell
set AppleScript's text item delimiters to linefeed
return procNames as text
`;
  const result = await runCmd("osascript", ["-e", script]);
  if (!result.ok) {
    return [];
  }
  return result.stdout
    .split("\n")
    .map((name) => normalizeAppName(name))
    .filter(Boolean);
}

function buildAllowedAppSet(allowedApps, extraAlwaysAllowed = []) {
  const allowed = new Set((allowedApps || []).map(normalizeAppName).filter(Boolean));
  for (const base of ALWAYS_ALLOWED_APPS) {
    allowed.add(base);
  }
  for (const extra of extraAlwaysAllowed || []) {
    const normalizedExtra = normalizeAppName(extra);
    if (normalizedExtra) {
      allowed.add(normalizedExtra);
    }
  }
  return allowed;
}

async function enforceBlockedApps(blockedApps) {
  const names = Array.from(new Set((blockedApps || []).map(normalizeAppName).filter(Boolean)));
  if (!names.length) {
    return;
  }
  for (const appName of names) {
    try {
      await terminateAppByName(appName);
      logInfo("Blocked app enforcement executed", { appName });
    } catch (error) {
      logWarn("Blocked app enforcement failed", { appName, error: error.message });
    }
  }
}

module.exports = {
  normalizeAppName,
  enforceBlockedApps,
  terminateAppByName,
  listRunningForegroundApps,
  buildAllowedAppSet,
  enforceAllowOnlyApps: async function enforceAllowOnlyApps(allowedApps, extraAlwaysAllowed = []) {
    const allowed = buildAllowedAppSet(allowedApps, extraAlwaysAllowed);

    const runningApps = await listRunningForegroundApps();
    for (const appName of runningApps) {
      if (allowed.has(appName)) {
        continue;
      }
      try {
        await terminateAppByName(appName);
        logInfo("Allow-only app enforcement closed app", { appName });
      } catch (error) {
        logWarn("Allow-only app enforcement failed", { appName, error: error.message });
      }
    }
  },
};
