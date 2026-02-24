const { execFile } = require("child_process");

function runOsa(script) {
  return new Promise((resolve) => {
    execFile("osascript", ["-e", script], (error, stdout) => {
      resolve({ ok: !error, stdout: String(stdout || "").trim() });
    });
  });
}

function normalizeHostname(urlString) {
  try {
    const u = new URL(urlString);
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch (_error) {
    return null;
  }
}

const BROWSER_URL_SCRIPTS = [
  {
    name: "Safari",
    script: `
if application "Safari" is running then
  tell application "Safari"
    if (count of documents) > 0 then
      return URL of front document
    end if
  end tell
end if
return ""
`,
  },
  {
    name: "Google Chrome",
    script: `
if application "Google Chrome" is running then
  tell application "Google Chrome"
    if (count of windows) > 0 then
      return URL of active tab of front window
    end if
  end tell
end if
return ""
`,
  },
  {
    name: "Brave Browser",
    script: `
if application "Brave Browser" is running then
  tell application "Brave Browser"
    if (count of windows) > 0 then
      return URL of active tab of front window
    end if
  end tell
end if
return ""
`,
  },
  {
    name: "Arc",
    script: `
if application "Arc" is running then
  tell application "Arc"
    if (count of windows) > 0 then
      return URL of active tab of front window
    end if
  end tell
end if
return ""
`,
  },
];

async function getActiveBrowserHostname() {
  for (const entry of BROWSER_URL_SCRIPTS) {
    const result = await runOsa(entry.script);
    if (!result.ok || !result.stdout) {
      continue;
    }
    const host = normalizeHostname(result.stdout);
    if (host) {
      return { browser: entry.name, host, url: result.stdout };
    }
  }
  return null;
}

module.exports = {
  getActiveBrowserHostname,
};
