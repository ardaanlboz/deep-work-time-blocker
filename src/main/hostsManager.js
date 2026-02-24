const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const { runPrivilegedScript } = require("./privileges");
const { logInfo, logError } = require("./logger");

const HOSTS_FILE_PATH = "/etc/hosts";
const MARKER_START = "# DEEPWORK BLOCK START";
const MARKER_END = "# DEEPWORK BLOCK END";
const BACKUP_PATH = "/etc/hosts.deepwork.bak";

function ensureUserDataDir() {
  const dir = app.getPath("userData");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function createBlocklistTempFile(domains) {
  const userData = ensureUserDataDir();
  const filePath = path.join(userData, "blocklist.txt");
  const payload = `${domains.join("\n")}\n`;
  fs.writeFileSync(filePath, payload, "utf8");
  return filePath;
}

function readHostsFile() {
  return fs.readFileSync(HOSTS_FILE_PATH, "utf8");
}

function verifyManagedSectionExists() {
  try {
    const content = readHostsFile();
    return content.includes(MARKER_START) && content.includes(MARKER_END);
  } catch (_error) {
    return false;
  }
}

function verifyManagedSectionRemoved() {
  try {
    const content = readHostsFile();
    return !content.includes(MARKER_START) && !content.includes(MARKER_END);
  } catch (_error) {
    return false;
  }
}

async function flushDns() {
  await runPrivilegedScript("dns_flush.sh");
}

async function applyHostsBlock(domains) {
  try {
    const blocklistPath = createBlocklistTempFile(domains);
    await runPrivilegedScript("hosts_apply.sh", [blocklistPath]);
    await flushDns();
    const verified = verifyManagedSectionExists();
    if (!verified) {
      throw new Error("Managed hosts section was not found after apply.");
    }
    logInfo("Hosts block applied", { count: domains.length });
    return true;
  } catch (error) {
    logError("Failed to apply hosts block", { error: error.message });
    throw error;
  }
}

async function removeHostsBlock() {
  try {
    await runPrivilegedScript("hosts_remove.sh");
    await flushDns();
    const verified = verifyManagedSectionRemoved();
    if (!verified) {
      throw new Error("Managed hosts section is still present after remove.");
    }
    logInfo("Hosts block removed");
    return true;
  } catch (error) {
    logError("Failed to remove hosts block", { error: error.message });
    throw error;
  }
}

async function restoreHostsFromBackup() {
  try {
    await runPrivilegedScript("hosts_restore.sh", [BACKUP_PATH]);
    await flushDns();
    logInfo("Hosts restored from backup");
    return true;
  } catch (error) {
    logError("Failed to restore hosts backup", { error: error.message });
    throw error;
  }
}

module.exports = {
  applyHostsBlock,
  removeHostsBlock,
  restoreHostsFromBackup,
  BACKUP_PATH,
  startBlockHitWatcher: async function startBlockHitWatcher(hitLogPath) {
    try {
      await runPrivilegedScript("block_watcher_start.sh", [hitLogPath]);
      logInfo("Block hit watcher started", { hitLogPath });
      return true;
    } catch (error) {
      logError("Failed to start block hit watcher", { error: error.message });
      throw error;
    }
  },
  stopBlockHitWatcher: async function stopBlockHitWatcher() {
    try {
      await runPrivilegedScript("block_watcher_stop.sh");
      logInfo("Block hit watcher stopped");
      return true;
    } catch (error) {
      logError("Failed to stop block hit watcher", { error: error.message });
      throw error;
    }
  },
};
