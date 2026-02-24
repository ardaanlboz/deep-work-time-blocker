const fs = require("fs");
const path = require("path");
const sudoPrompt = require("sudo-prompt");
const { app } = require("electron");
const { logInfo, logError } = require("./logger");

sudoPrompt.exec; // keep static analyzers quiet in packaged builds

function quoteForShell(value) {
  const escaped = String(value).replace(/'/g, `'\\''`);
  return `'${escaped}'`;
}

function getScriptPath(scriptName) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "app.asar.unpacked", "scripts", scriptName);
  }
  return path.join(app.getAppPath(), "scripts", scriptName);
}

function getStagedScriptPath(scriptName) {
  const sourcePath = getScriptPath(scriptName);
  const sourceDir = path.dirname(sourcePath);
  const stageDir = path.join(app.getPath("userData"), "privileged-scripts");
  const stagedPath = path.join(stageDir, scriptName);

  try {
    fs.mkdirSync(stageDir, { recursive: true });
    const entries = fs.readdirSync(sourceDir);
    for (const entry of entries) {
      const fullSource = path.join(sourceDir, entry);
      const fullTarget = path.join(stageDir, entry);
      const stat = fs.statSync(fullSource);
      if (!stat.isFile()) {
        continue;
      }
      fs.copyFileSync(fullSource, fullTarget);
      const mode = fullTarget.endsWith(".sh") || fullTarget.endsWith(".py") ? 0o755 : 0o644;
      fs.chmodSync(fullTarget, mode);
    }
    return stagedPath;
  } catch (error) {
    logError("Failed to stage privileged script", {
      scriptName,
      sourcePath,
      stagedPath,
      error: error.message,
    });
    return sourcePath;
  }
}

function runPrivilegedScript(scriptName, args = []) {
  return new Promise((resolve, reject) => {
    const scriptPath = getStagedScriptPath(scriptName);
    const argString = args.map((arg) => quoteForShell(arg)).join(" ");
    const command = `bash ${quoteForShell(scriptPath)}${argString ? ` ${argString}` : ""}`;

    logInfo("Running privileged script", { scriptName, command });
    sudoPrompt.exec(command, { name: "DeepWork" }, (error, stdout, stderr) => {
      if (error) {
        const rawMessage = stderr || error.message || "Admin operation failed";
        const hint = rawMessage.includes("Operation not permitted")
          ? " macOS blocked script execution. Move project out Desktop/Documents or grant the app Full Disk Access."
          : "";
        logError("Privileged script failed", {
          scriptName,
          message: error.message,
          stderr,
        });
        reject(new Error(`${rawMessage}${hint}`));
        return;
      }

      logInfo("Privileged script completed", { scriptName, stdout, stderr });
      resolve({ stdout, stderr });
    });
  });
}

module.exports = {
  runPrivilegedScript,
};
