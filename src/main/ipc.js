const { ipcMain, shell, dialog } = require("electron");
const {
  getConfig,
  setConfig,
  normalizeDomain,
} = require("./config");
const { normalizeAppName } = require("./appBlocker");
const {
  listProfiles,
  upsertProfileByName,
  deleteProfile,
  applyProfile,
  snapshotCurrentSettings,
} = require("./profiles");
const { listRunningForegroundApps, buildAllowedAppSet } = require("./appBlocker");
const {
  startSession,
  stopSession,
  getSessionStatus,
  clearRecoveryFlag,
} = require("./session");
const { showReminderPopup } = require("./reminderWindow");
const { restoreHostsFromBackup, stopBlockHitWatcher } = require("./hostsManager");
const { getLogFilePath, logInfo, logError } = require("./logger");
const { getCurrentDraft, setCurrentDraft, listNotes, saveNoteEntry } = require("./notesManager");

const IPC_CHANNELS = {
  SESSION_START: "session:start",
  SESSION_STOP: "session:stop",
  SESSION_STATUS: "session:status",
  BLOCKLIST_ADD: "blocklist:add",
  BLOCKLIST_REMOVE: "blocklist:remove",
  BLOCKLIST_LIST: "blocklist:list",
  APPBLOCK_ADD: "appblock:add",
  APPBLOCK_REMOVE: "appblock:remove",
  APPBLOCK_LIST: "appblock:list",
  APPBLOCK_PICK: "appblock:pick",
  ALLOWAPP_ADD: "allowapp:add",
  ALLOWAPP_REMOVE: "allowapp:remove",
  ALLOWAPP_LIST: "allowapp:list",
  ALLOWAPP_PICK: "allowapp:pick",
  VIDEO_SET: "video:set",
  VIDEO_GET: "video:get",
  VIDEO_PICK: "video:pick",
  REMINDER_TEST: "reminder:test",
  HOSTS_RESTORE: "hosts:restore",
  LOGS_OPEN: "logs:open",
  SETTINGS_GET: "settings:get",
  SETTINGS_SET: "settings:set",
  SESSION_PREFLIGHT: "session:preflight",
  PROFILES_LIST: "profiles:list",
  PROFILES_SAVE: "profiles:save",
  PROFILES_APPLY: "profiles:apply",
  PROFILES_DELETE: "profiles:delete",
  REPORTS_LIST: "reports:list",
  NOTES_DRAFT_GET: "notes:draft:get",
  NOTES_DRAFT_SET: "notes:draft:set",
  NOTES_LIST: "notes:list",
  NOTES_SAVE: "notes:save",
};

async function safeInvoke(handler) {
  try {
    const data = await handler();
    return { ok: true, data };
  } catch (error) {
    logError("IPC call failed", { error: error.message });
    return { ok: false, error: error.message };
  }
}

function registerIpcHandlers(mainWindow) {
  ipcMain.handle(IPC_CHANNELS.SESSION_START, async () =>
    safeInvoke(async () => startSession())
  );

  ipcMain.handle(IPC_CHANNELS.SESSION_STOP, async () =>
    safeInvoke(async () => stopSession())
  );

  ipcMain.handle(IPC_CHANNELS.SESSION_STATUS, async () =>
    safeInvoke(async () => getSessionStatus())
  );

  ipcMain.handle(IPC_CHANNELS.SESSION_PREFLIGHT, async () =>
    safeInvoke(async () => {
      const config = getConfig();
      if (!config.allowOnlySelectedApps) {
        return { allowOnlySelectedApps: false, willCloseApps: [] };
      }
      const allowed = buildAllowedAppSet(config.allowedApps, ["DeepWork"]);
      const running = await listRunningForegroundApps();
      const willCloseApps = running.filter((name) => !allowed.has(name));
      return {
        allowOnlySelectedApps: true,
        willCloseApps,
        appCloseWarningSeconds: config.appCloseWarningSeconds,
      };
    })
  );

  ipcMain.handle(IPC_CHANNELS.BLOCKLIST_ADD, async (_event, domainInput) =>
    safeInvoke(async () => {
      const normalized = normalizeDomain(domainInput);
      if (!normalized) {
        throw new Error("Invalid domain. Please enter a valid domain like instagram.com");
      }
      const config = getConfig();
      const list = Array.from(new Set([...config.blockedDomains, normalized]));
      setConfig({ blockedDomains: list });
      logInfo("Domain added to blocklist", { domain: normalized });
      return list;
    })
  );

  ipcMain.handle(IPC_CHANNELS.BLOCKLIST_REMOVE, async (_event, domainInput) =>
    safeInvoke(async () => {
      const normalized = normalizeDomain(domainInput) || String(domainInput).trim().toLowerCase();
      const config = getConfig();
      const list = config.blockedDomains.filter((entry) => entry !== normalized);
      setConfig({ blockedDomains: list });
      logInfo("Domain removed from blocklist", { domain: normalized });
      return list;
    })
  );

  ipcMain.handle(IPC_CHANNELS.BLOCKLIST_LIST, async () =>
    safeInvoke(async () => getConfig().blockedDomains)
  );

  ipcMain.handle(IPC_CHANNELS.APPBLOCK_ADD, async (_event, appInput) =>
    safeInvoke(async () => {
      const normalized = normalizeAppName(appInput);
      if (!normalized) {
        throw new Error("Invalid app name. Enter an app name like Safari or choose a .app file.");
      }
      const config = getConfig();
      const list = Array.from(new Set([...(config.blockedApps || []), normalized]));
      setConfig({ blockedApps: list });
      logInfo("App added to blocked apps", { app: normalized });
      return list;
    })
  );

  ipcMain.handle(IPC_CHANNELS.APPBLOCK_REMOVE, async (_event, appInput) =>
    safeInvoke(async () => {
      const normalized = normalizeAppName(appInput) || String(appInput || "").trim();
      const config = getConfig();
      const list = (config.blockedApps || []).filter((entry) => entry !== normalized);
      setConfig({ blockedApps: list });
      logInfo("App removed from blocked apps", { app: normalized });
      return list;
    })
  );

  ipcMain.handle(IPC_CHANNELS.APPBLOCK_LIST, async () =>
    safeInvoke(async () => getConfig().blockedApps || [])
  );

  ipcMain.handle(IPC_CHANNELS.APPBLOCK_PICK, async () =>
    safeInvoke(async () => {
      const result = await dialog.showOpenDialog({
        title: "Choose app to block",
        properties: ["openFile"],
        filters: [{ name: "Applications", extensions: ["app"] }],
      });
      if (result.canceled || !result.filePaths.length) {
        return { canceled: true };
      }
      const pickedPath = result.filePaths[0];
      const normalized = normalizeAppName(pickedPath);
      if (!normalized) {
        throw new Error("Could not read application name from selected path.");
      }
      const config = getConfig();
      const list = Array.from(new Set([...(config.blockedApps || []), normalized]));
      setConfig({ blockedApps: list });
      logInfo("App selected and added to blocked apps", { app: normalized, path: pickedPath });
      return { canceled: false, app: normalized, list };
    })
  );

  ipcMain.handle(IPC_CHANNELS.ALLOWAPP_ADD, async (_event, appInput) =>
    safeInvoke(async () => {
      const normalized = normalizeAppName(appInput);
      if (!normalized) {
        throw new Error("Invalid app name. Enter an app name like Safari or choose a .app file.");
      }
      const config = getConfig();
      const list = Array.from(new Set([...(config.allowedApps || []), normalized]));
      setConfig({ allowedApps: list });
      logInfo("App added to allowed apps", { app: normalized });
      return list;
    })
  );

  ipcMain.handle(IPC_CHANNELS.ALLOWAPP_REMOVE, async (_event, appInput) =>
    safeInvoke(async () => {
      const normalized = normalizeAppName(appInput) || String(appInput || "").trim();
      const config = getConfig();
      const list = (config.allowedApps || []).filter((entry) => entry !== normalized);
      setConfig({ allowedApps: list });
      logInfo("App removed from allowed apps", { app: normalized });
      return list;
    })
  );

  ipcMain.handle(IPC_CHANNELS.ALLOWAPP_LIST, async () =>
    safeInvoke(async () => getConfig().allowedApps || [])
  );

  ipcMain.handle(IPC_CHANNELS.ALLOWAPP_PICK, async () =>
    safeInvoke(async () => {
      const result = await dialog.showOpenDialog({
        title: "Choose app to allow",
        properties: ["openFile"],
        filters: [{ name: "Applications", extensions: ["app"] }],
      });
      if (result.canceled || !result.filePaths.length) {
        return { canceled: true };
      }
      const pickedPath = result.filePaths[0];
      const normalized = normalizeAppName(pickedPath);
      if (!normalized) {
        throw new Error("Could not read application name from selected path.");
      }
      const config = getConfig();
      const list = Array.from(new Set([...(config.allowedApps || []), normalized]));
      setConfig({ allowedApps: list });
      logInfo("App selected and added to allowed apps", { app: normalized, path: pickedPath });
      return { canceled: false, app: normalized, list };
    })
  );

  ipcMain.handle(IPC_CHANNELS.VIDEO_SET, async (_event, url) =>
    safeInvoke(async () => {
      const nextUrl = String(url || "").trim();
      setConfig({ videoUrl: nextUrl });
      logInfo("Video URL updated");
      return nextUrl;
    })
  );

  ipcMain.handle(IPC_CHANNELS.VIDEO_GET, async () =>
    safeInvoke(async () => getConfig().videoUrl)
  );

  ipcMain.handle(IPC_CHANNELS.VIDEO_PICK, async () =>
    safeInvoke(async () => {
      const result = await dialog.showOpenDialog({
        title: "Select reminder video file",
        properties: ["openFile"],
        filters: [
          { name: "Video", extensions: ["mp4", "mov", "m4v", "webm", "mkv", "avi"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });
      if (result.canceled || !result.filePaths.length) {
        return { canceled: true };
      }
      const selected = result.filePaths[0];
      setConfig({ videoUrl: selected });
      logInfo("Video file selected", { selected });
      return { canceled: false, path: selected };
    })
  );

  ipcMain.handle(IPC_CHANNELS.REMINDER_TEST, async () =>
    safeInvoke(async () => {
      showReminderPopup(getConfig().videoUrl);
      return { shown: true };
    })
  );

  ipcMain.handle(IPC_CHANNELS.HOSTS_RESTORE, async () =>
    safeInvoke(async () => {
      await stopBlockHitWatcher().catch(() => {});
      await restoreHostsFromBackup();
      const config = getConfig();
      if (config.lastSession.active) {
        setConfig({
          lastSession: {
            ...config.lastSession,
            active: false,
            endAt: new Date().toISOString(),
          },
        });
      }
      clearRecoveryFlag();
      return { restored: true };
    })
  );

  ipcMain.handle(IPC_CHANNELS.LOGS_OPEN, async () =>
    safeInvoke(async () => {
      const path = getLogFilePath();
      await shell.openPath(path);
      return { path };
    })
  );

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () =>
    safeInvoke(async () => {
      const {
        sessionMinutes,
        lockStopMinutes,
        strictMode,
        blockedApps,
        allowedApps,
        allowOnlySelectedApps,
        appCloseWarningSeconds,
      } = getConfig();
      return {
        sessionMinutes,
        lockStopMinutes,
        strictMode,
        blockedApps,
        allowedApps,
        allowOnlySelectedApps,
        appCloseWarningSeconds,
      };
    })
  );

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_event, incoming) =>
    safeInvoke(async () => {
      const sessionMinutes = Number(incoming?.sessionMinutes);
      const lockStopMinutes = Number(incoming?.lockStopMinutes);
      const strictMode = Boolean(incoming?.strictMode);
      const allowOnlySelectedApps = Boolean(incoming?.allowOnlySelectedApps);
      const appCloseWarningSeconds = Number(incoming?.appCloseWarningSeconds);
      if (!Number.isFinite(sessionMinutes) || sessionMinutes < 1 || sessionMinutes > 600) {
        throw new Error("Session minutes must be between 1 and 600.");
      }
      if (!Number.isFinite(lockStopMinutes) || lockStopMinutes < 0 || lockStopMinutes > 600) {
        throw new Error("Stop-lock minutes must be between 0 and 600.");
      }
      if (
        !Number.isFinite(appCloseWarningSeconds) ||
        appCloseWarningSeconds < 0 ||
        appCloseWarningSeconds > 60
      ) {
        throw new Error("App close warning seconds must be between 0 and 60.");
      }
      const next = setConfig({
        sessionMinutes: Math.floor(sessionMinutes),
        lockStopMinutes: Math.floor(lockStopMinutes),
        strictMode,
        allowOnlySelectedApps,
        appCloseWarningSeconds: Math.floor(appCloseWarningSeconds),
      });
      logInfo("Session settings updated", {
        sessionMinutes: next.sessionMinutes,
        lockStopMinutes: next.lockStopMinutes,
        strictMode: next.strictMode,
        allowOnlySelectedApps: next.allowOnlySelectedApps,
        appCloseWarningSeconds: next.appCloseWarningSeconds,
      });
      return {
        sessionMinutes: next.sessionMinutes,
        lockStopMinutes: next.lockStopMinutes,
        strictMode: next.strictMode,
        allowOnlySelectedApps: next.allowOnlySelectedApps,
        appCloseWarningSeconds: next.appCloseWarningSeconds,
      };
    })
  );

  ipcMain.handle(IPC_CHANNELS.PROFILES_LIST, async () => safeInvoke(async () => listProfiles()));

  ipcMain.handle(IPC_CHANNELS.PROFILES_SAVE, async (_event, payload) =>
    safeInvoke(async () => {
      const name = payload?.name;
      const profile = upsertProfileByName(name, snapshotCurrentSettings());
      return profile;
    })
  );

  ipcMain.handle(IPC_CHANNELS.PROFILES_APPLY, async (_event, payload) =>
    safeInvoke(async () => {
      const id = String(payload?.id || "");
      return applyProfile(id);
    })
  );

  ipcMain.handle(IPC_CHANNELS.PROFILES_DELETE, async (_event, payload) =>
    safeInvoke(async () => {
      const id = String(payload?.id || "");
      deleteProfile(id);
      return true;
    })
  );

  ipcMain.handle(IPC_CHANNELS.REPORTS_LIST, async () =>
    safeInvoke(async () => getConfig().activityReports || [])
  );

  ipcMain.handle(IPC_CHANNELS.NOTES_DRAFT_GET, async () =>
    safeInvoke(async () => getCurrentDraft())
  );

  ipcMain.handle(IPC_CHANNELS.NOTES_DRAFT_SET, async (_event, payload) =>
    safeInvoke(async () => setCurrentDraft(payload?.text))
  );

  ipcMain.handle(IPC_CHANNELS.NOTES_LIST, async () =>
    safeInvoke(async () => listNotes())
  );

  ipcMain.handle(IPC_CHANNELS.NOTES_SAVE, async (_event, payload) =>
    safeInvoke(async () => {
      const cfg = getConfig();
      const sessionNumber = cfg.lastSession.sessionNumber;
      const startAt = cfg.lastSession.startAt;
      const endAt = cfg.lastSession.endAt || new Date().toISOString();
      if (!sessionNumber || !startAt) {
        throw new Error("No active session metadata found for saving notes.");
      }
      const saved = saveNoteEntry({
        sessionNumber,
        startAt,
        endAt,
        text: payload?.text || cfg.currentSessionNoteDraft || "",
      });
      setConfig({ currentSessionNoteDraft: "" });
      return saved;
    })
  );

  return {
    sendStatusUpdate(status) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("session:updated", status);
      }
    },
  };
}

module.exports = {
  IPC_CHANNELS,
  registerIpcHandlers,
};
