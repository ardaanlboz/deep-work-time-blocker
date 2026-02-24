const { randomUUID } = require("crypto");
const { getConfig, setConfig } = require("./config");

function listProfiles() {
  return getConfig().profiles || [];
}

function getProfile(id) {
  return listProfiles().find((p) => p.id === id) || null;
}

function upsertProfileByName(name, settings) {
  const trimmed = String(name || "").trim();
  if (!trimmed) {
    throw new Error("Profile name is required.");
  }

  const config = getConfig();
  const existing = (config.profiles || []).find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
  const nextProfile = existing
    ? { ...existing, settings }
    : { id: randomUUID(), name: trimmed, createdAt: new Date().toISOString(), settings };

  const nextProfiles = existing
    ? (config.profiles || []).map((p) => (p.id === existing.id ? nextProfile : p))
    : [...(config.profiles || []), nextProfile];

  setConfig({ profiles: nextProfiles });
  return nextProfile;
}

function deleteProfile(id) {
  const config = getConfig();
  const nextProfiles = (config.profiles || []).filter((p) => p.id !== id);
  setConfig({ profiles: nextProfiles });
  return true;
}

function applyProfile(id) {
  const profile = getProfile(id);
  if (!profile) {
    throw new Error("Profile not found.");
  }
  const settings = profile.settings || {};
  const patch = {
    ...settings,
  };
  setConfig(patch);
  return getConfig();
}

function snapshotCurrentSettings() {
  const config = getConfig();
  return {
    blockedDomains: config.blockedDomains,
    blockedApps: config.blockedApps,
    allowedApps: config.allowedApps,
    allowOnlySelectedApps: config.allowOnlySelectedApps,
    appCloseWarningSeconds: config.appCloseWarningSeconds,
    videoUrl: config.videoUrl,
    sessionMinutes: config.sessionMinutes,
    lockStopMinutes: config.lockStopMinutes,
    strictMode: config.strictMode,
  };
}

module.exports = {
  listProfiles,
  upsertProfileByName,
  deleteProfile,
  applyProfile,
  snapshotCurrentSettings,
};
