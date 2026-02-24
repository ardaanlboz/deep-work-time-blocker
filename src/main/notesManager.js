const { getConfig, setConfig } = require("./config");

function toDayKey(isoString) {
  try {
    const d = new Date(isoString);
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  } catch (_error) {
    return "unknown";
  }
}

function getCurrentDraft() {
  const cfg = getConfig();
  return {
    sessionNumber: cfg.lastSession.sessionNumber || null,
    text: cfg.currentSessionNoteDraft || "",
  };
}

function setCurrentDraft(text) {
  const next = String(text || "");
  setConfig({ currentSessionNoteDraft: next });
  return getCurrentDraft();
}

function listNotes() {
  const cfg = getConfig();
  return cfg.sessionNotes || [];
}

function saveNoteEntry({ sessionNumber, startAt, endAt, text }) {
  const cfg = getConfig();
  if (!sessionNumber || !startAt || !endAt) {
    throw new Error("Missing session metadata for note save.");
  }
  const trimmed = String(text || "").trim();
  const entry = {
    sessionNumber,
    day: toDayKey(startAt),
    startAt,
    endAt,
    text: trimmed,
  };

  const existing = cfg.sessionNotes || [];
  // Replace note if same sessionNumber already exists.
  const nextNotes = [
    entry,
    ...existing.filter((n) => n.sessionNumber !== sessionNumber),
  ].slice(0, 200);

  setConfig({ sessionNotes: nextNotes });
  return entry;
}

function finalizeDraftIfAny() {
  const cfg = getConfig();
  const sessionNumber = cfg.lastSession.sessionNumber;
  const startAt = cfg.lastSession.startAt;
  const endAt = cfg.lastSession.endAt;
  const draft = String(cfg.currentSessionNoteDraft || "").trim();

  if (!draft) {
    return null;
  }
  if (!sessionNumber || !startAt || !endAt) {
    return null;
  }

  const saved = saveNoteEntry({ sessionNumber, startAt, endAt, text: draft });
  setConfig({ currentSessionNoteDraft: "" });
  return saved;
}

module.exports = {
  toDayKey,
  getCurrentDraft,
  setCurrentDraft,
  listNotes,
  saveNoteEntry,
  finalizeDraftIfAny,
};
