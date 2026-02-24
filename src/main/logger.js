const log = require("electron-log/main");

log.initialize();
log.transports.file.level = "info";
log.transports.console.level = "info";

function logInfo(message, meta = {}) {
  log.info(message, meta);
}

function logWarn(message, meta = {}) {
  log.warn(message, meta);
}

function logError(message, meta = {}) {
  log.error(message, meta);
}

function getLogFilePath() {
  return log.transports.file.getFile().path;
}

module.exports = {
  logInfo,
  logWarn,
  logError,
  getLogFilePath,
};
