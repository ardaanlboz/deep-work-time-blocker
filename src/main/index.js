const path = require("path");
const { app, BrowserWindow } = require("electron");
const { registerIpcHandlers } = require("./ipc");
const {
  setStatusListener,
  resumeOrRecoverIfNeeded,
  beforeQuitCleanup,
} = require("./session");
const { setConfig } = require("./config");
const { logInfo, logError } = require("./logger");
const { listProfiles, upsertProfileByName } = require("./profiles");

let mainWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 920,
    minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  logInfo("DeepWork app started");
  // Safety default: allow-only mode should start OFF each launch.
  setConfig({ allowOnlySelectedApps: false });
  // Seed a few starter presets once.
  if (listProfiles().length === 0) {
    upsertProfileByName("Writing (Strict)", {
      allowOnlySelectedApps: true,
      appCloseWarningSeconds: 5,
      sessionMinutes: 50,
      lockStopMinutes: 10,
      strictMode: true,
      allowedApps: ["DeepWork", "Notes"],
      blockedDomains: [],
      blockedApps: [],
    });
    upsertProfileByName("Coding", {
      allowOnlySelectedApps: false,
      sessionMinutes: 50,
      lockStopMinutes: 5,
      strictMode: true,
      blockedDomains: ["youtube.com", "instagram.com"],
      blockedApps: [],
    });
  }
  createMainWindow();
  const ipc = registerIpcHandlers(mainWindow);
  setStatusListener((status) => ipc.sendStatusUpdate(status));
  resumeOrRecoverIfNeeded();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("before-quit", () => {
  beforeQuitCleanup();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

process.on("uncaughtException", (error) => {
  logError("Uncaught exception", { error: error.message, stack: error.stack });
});
