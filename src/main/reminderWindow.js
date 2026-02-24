const { BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { app } = require("electron");
const { logInfo } = require("./logger");

let reminderWindow = null;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toEmbeddableUrl(input) {
  if (!input) {
    return null;
  }
  try {
    const parsed = new URL(input);
    if (parsed.hostname.includes("youtube.com") && parsed.searchParams.get("v")) {
      return `https://www.youtube.com/embed/${parsed.searchParams.get("v")}`;
    }
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.replace("/", "");
      return `https://www.youtube.com/embed/${id}`;
    }
    return parsed.toString();
  } catch (_error) {
    return null;
  }
}

function toMediaSource(input) {
  if (!input) {
    return null;
  }
  const trimmed = String(input).trim();
  if (!trimmed) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    const embedUrl = toEmbeddableUrl(trimmed);
    return embedUrl ? { type: "url", src: embedUrl } : null;
  }
  if (fs.existsSync(trimmed)) {
    return { type: "file", src: pathToFileURL(trimmed).toString() };
  }
  return null;
}

function buildReminderHtml(videoSource) {
  const source = toMediaSource(videoSource);
  const safeSource = source ? escapeHtml(source.src) : null;

  let body = `<div class="missing">Set your reminder video file in the app settings, then test again.</div>`;
  if (source && source.type === "url") {
    body = `<iframe src="${safeSource}" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
  } else if (source && source.type === "file") {
    body = `<video src="${safeSource}" controls autoplay muted loop playsinline></video>`;
  }

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>DeepWork Reminder</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #0f172a; color: #f8fafc; }
      .wrap { padding: 12px; display: grid; gap: 10px; }
      .header { display: flex; justify-content: space-between; align-items: center; }
      .title { font-size: 16px; font-weight: 600; }
      iframe, video { width: 100%; height: 180px; border: 0; border-radius: 8px; background: #020617; }
      .missing { min-height: 180px; display: grid; place-items: center; text-align: center; background: #1e293b; border-radius: 8px; padding: 16px; }
      button { border: 0; border-radius: 8px; padding: 8px 12px; cursor: pointer; background: #2563eb; color: #fff; font-weight: 600; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="header">
        <div class="title">Back to work.</div>
        <button onclick="window.close()">Close</button>
      </div>
      ${body}
    </div>
  </body>
</html>`;
}

function showReminderPopup(videoUrl) {
  closeReminderPopup();
  reminderWindow = new BrowserWindow({
    width: 420,
    height: 300,
    alwaysOnTop: true,
    skipTaskbar: true,
    movable: true,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  });
  reminderWindow.on("closed", () => {
    reminderWindow = null;
  });
  const htmlDir = path.join(app.getPath("userData"), "reminder-popup");
  const htmlPath = path.join(htmlDir, "index.html");
  fs.mkdirSync(htmlDir, { recursive: true });
  fs.writeFileSync(htmlPath, buildReminderHtml(videoUrl), "utf8");
  reminderWindow.loadFile(htmlPath);
  logInfo("Reminder popup shown");
}

function closeReminderPopup() {
  if (reminderWindow && !reminderWindow.isDestroyed()) {
    reminderWindow.close();
    reminderWindow = null;
  }
}

module.exports = {
  showReminderPopup,
  closeReminderPopup,
};
