const api = window.deepworkApi;
const C = api.channels;

const el = {
  globalStatus: document.getElementById("globalStatus"),
  sessionStatus: document.getElementById("sessionStatus"),
  timeRemaining: document.getElementById("timeRemaining"),
  startSessionButton: document.getElementById("startSessionButton"),
  stopSessionButton: document.getElementById("stopSessionButton"),
  sessionMinutesInput: document.getElementById("sessionMinutesInput"),
  lockStopMinutesInput: document.getElementById("lockStopMinutesInput"),
  strictModeInput: document.getElementById("strictModeInput"),
  allowOnlyAppsInput: document.getElementById("allowOnlyAppsInput"),
  allowOnlyAppsHelp: document.getElementById("allowOnlyAppsHelp"),
  allowOnlyAppsControls: document.getElementById("allowOnlyAppsControls"),
  appCloseWarningSecondsInput: document.getElementById("appCloseWarningSecondsInput"),
  stopLockStatus: document.getElementById("stopLockStatus"),
  saveSettingsButton: document.getElementById("saveSettingsButton"),
  domainInput: document.getElementById("domainInput"),
  addDomainButton: document.getElementById("addDomainButton"),
  blocklist: document.getElementById("blocklist"),
  appInput: document.getElementById("appInput"),
  addAppButton: document.getElementById("addAppButton"),
  pickAppButton: document.getElementById("pickAppButton"),
  appBlocklist: document.getElementById("appBlocklist"),
  allowedAppInput: document.getElementById("allowedAppInput"),
  addAllowedAppButton: document.getElementById("addAllowedAppButton"),
  pickAllowedAppButton: document.getElementById("pickAllowedAppButton"),
  allowedAppList: document.getElementById("allowedAppList"),
  profileSelect: document.getElementById("profileSelect"),
  applyProfileButton: document.getElementById("applyProfileButton"),
  saveProfileButton: document.getElementById("saveProfileButton"),
  deleteProfileButton: document.getElementById("deleteProfileButton"),
  activityReport: document.getElementById("activityReport"),
  notesSessionNumber: document.getElementById("notesSessionNumber"),
  notesInput: document.getElementById("notesInput"),
  saveNotesButton: document.getElementById("saveNotesButton"),
  notesHistory: document.getElementById("notesHistory"),
  videoUrlInput: document.getElementById("videoUrlInput"),
  pickVideoButton: document.getElementById("pickVideoButton"),
  saveVideoButton: document.getElementById("saveVideoButton"),
  testReminderButton: document.getElementById("testReminderButton"),
  restoreBackupButton: document.getElementById("restoreBackupButton"),
  openLogsButton: document.getElementById("openLogsButton"),
  feedbackPanel: document.getElementById("feedbackPanel"),
  recoveryBanner: document.getElementById("recoveryBanner"),
  restoreNowButton: document.getElementById("restoreNowButton"),
};

function formatSeconds(totalSeconds) {
  const s = Math.max(0, Number(totalSeconds) || 0);
  const hours = String(Math.floor(s / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const seconds = String(s % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function showFeedback(message, type = "success") {
  el.feedbackPanel.textContent = message;
  el.feedbackPanel.classList.remove("hidden", "error", "success");
  el.feedbackPanel.classList.add(type);
}

function showError(error) {
  showFeedback(error, "error");
}

function hideFeedback() {
  el.feedbackPanel.classList.add("hidden");
}

function setBusy(button, isBusy, labelWhileBusy) {
  if (!button) {
    return;
  }
  if (!button.dataset.originalLabel) {
    button.dataset.originalLabel = button.textContent || "";
  }
  button.disabled = isBusy;
  button.textContent = isBusy ? labelWhileBusy : button.dataset.originalLabel;
}

async function invoke(channel, payload) {
  const result = await api.invoke(channel, payload);
  if (!result.ok) {
    throw new Error(result.error || "Operation failed");
  }
  return result.data;
}

function renderBlocklist(domains) {
  el.blocklist.innerHTML = "";
  if (!domains.length) {
    const item = document.createElement("li");
    item.textContent = "No blocked websites yet.";
    el.blocklist.appendChild(item);
    return;
  }

  domains.forEach((domain) => {
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = domain;
    const removeButton = document.createElement("button");
    removeButton.textContent = "Remove";
    removeButton.classList.add("danger");
    removeButton.addEventListener("click", async () => {
      try {
        const next = await invoke(C.BLOCKLIST_REMOVE, domain);
        renderBlocklist(next);
        showFeedback(`Removed ${domain}`);
      } catch (error) {
        showError(error.message);
      }
    });
    item.appendChild(label);
    item.appendChild(removeButton);
    el.blocklist.appendChild(item);
  });
}

function renderAppBlocklist(apps) {
  el.appBlocklist.innerHTML = "";
  if (!apps.length) {
    const item = document.createElement("li");
    item.textContent = "No blocked apps yet.";
    el.appBlocklist.appendChild(item);
    return;
  }

  apps.forEach((appName) => {
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = appName;
    const removeButton = document.createElement("button");
    removeButton.textContent = "Remove";
    removeButton.classList.add("danger");
    removeButton.addEventListener("click", async () => {
      try {
        const next = await invoke(C.APPBLOCK_REMOVE, appName);
        renderAppBlocklist(next);
        showFeedback(`Removed app block: ${appName}`);
      } catch (error) {
        showError(error.message);
      }
    });
    item.appendChild(label);
    item.appendChild(removeButton);
    el.appBlocklist.appendChild(item);
  });
}

function renderAllowedAppList(apps) {
  el.allowedAppList.innerHTML = "";
  if (!apps.length) {
    const item = document.createElement("li");
    item.textContent = "No allowed apps selected yet.";
    el.allowedAppList.appendChild(item);
    return;
  }

  apps.forEach((appName) => {
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = appName;
    const removeButton = document.createElement("button");
    removeButton.textContent = "Remove";
    removeButton.classList.add("danger");
    removeButton.addEventListener("click", async () => {
      try {
        const next = await invoke(C.ALLOWAPP_REMOVE, appName);
        renderAllowedAppList(next);
        showFeedback(`Removed allowed app: ${appName}`);
      } catch (error) {
        showError(error.message);
      }
    });
    item.appendChild(label);
    item.appendChild(removeButton);
    el.allowedAppList.appendChild(item);
  });
}

function renderStatus(status) {
  const active = Boolean(status.active);
  el.sessionStatus.textContent = active ? "Active" : "Inactive";
  el.globalStatus.textContent = active ? "Active" : "Inactive";
  el.globalStatus.classList.toggle("active", active);
  el.timeRemaining.textContent = formatSeconds(status.remainingSeconds);
  el.recoveryBanner.classList.toggle("hidden", !status.recoveryRequired);
  if (status.stopLocked) {
    el.stopLockStatus.textContent = `Locked for ${formatSeconds(status.stopLockRemainingSeconds)} more`;
    el.stopSessionButton.disabled = true;
    el.stopSessionButton.title = "Stop is currently locked by session settings.";
  } else {
    const lockWindow = Number(status.lockStopMinutes || 0);
    el.stopLockStatus.textContent =
      lockWindow > 0 ? `Unlocked (lock window: ${lockWindow} min)` : "Not locked";
    el.stopSessionButton.disabled = false;
    el.stopSessionButton.title = "";
  }
}

function renderAllowOnlyMode(isEnabled) {
  const enabled = Boolean(isEnabled);
  if (el.allowOnlyAppsControls) {
    el.allowOnlyAppsControls.classList.toggle("hidden", !enabled);
  }
  if (el.allowedAppList) {
    el.allowedAppList.classList.toggle("hidden", !enabled);
  }
  if (el.allowOnlyAppsHelp) {
    el.allowOnlyAppsHelp.textContent = enabled
      ? "Allow-only mode is ON. Apps not in the allowlist will be closed during the session."
      : "Allow-only mode is OFF. No apps will be closed unless you use the Apps to Block list.";
  }
}

function renderProfiles(profiles) {
  if (!el.profileSelect) {
    return;
  }
  el.profileSelect.innerHTML = "";
  const list = profiles || [];
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = list.length ? "Select preset..." : "No presets yet";
  el.profileSelect.appendChild(placeholder);
  for (const p of list) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    el.profileSelect.appendChild(opt);
  }
}

function renderActivityReport(reports) {
  if (!el.activityReport) {
    return;
  }
  const list = reports || [];
  if (!list.length) {
    el.activityReport.textContent = "No sessions recorded yet.";
    return;
  }
  const r = list[0];
  el.activityReport.innerHTML = `
    <div><strong>Last session:</strong> ${new Date(r.startedAt).toLocaleString()} (${r.durationSeconds}s)</div>
    <div>Blocked site hits: ${r.blockedSiteHits}</div>
    <div>Reminder popups shown: ${r.reminderPopupsShown}</div>
    <div>Apps warned: ${r.appsWarned}</div>
    <div>Apps closed: ${r.appsClosed}</div>
    <div>Apps closed list: ${(r.appsClosedNames || []).slice(0, 8).join(", ")}${(r.appsClosedNames || []).length > 8 ? "..." : ""}</div>
  `;
}

function renderNotesHeader(sessionNumber) {
  if (el.notesSessionNumber) {
    el.notesSessionNumber.textContent = sessionNumber ? `#${sessionNumber}` : "-";
  }
}

function renderNotesHistory(notes) {
  if (!el.notesHistory) {
    return;
  }
  el.notesHistory.innerHTML = "";
  const list = notes || [];
  if (!list.length) {
    const item = document.createElement("li");
    item.textContent = "No notes saved yet.";
    el.notesHistory.appendChild(item);
    return;
  }

  list.slice(0, 20).forEach((n) => {
    const item = document.createElement("li");
    const label = document.createElement("span");
    const preview = String(n.text || "").replace(/\s+/g, " ").trim();
    label.textContent = `#${n.sessionNumber} · ${n.day} · ${preview.slice(0, 60)}${preview.length > 60 ? "..." : ""}`;
    const viewBtn = document.createElement("button");
    viewBtn.textContent = "View";
    viewBtn.addEventListener("click", () => {
      el.notesInput.value = n.text || "";
      showFeedback(`Loaded notes for session #${n.sessionNumber}`);
    });
    item.appendChild(label);
    item.appendChild(viewBtn);
    el.notesHistory.appendChild(item);
  });
}

async function refreshInitialState() {
  const [status, blocklist, appBlocklist, allowedApps, videoUrl, settings, profiles, reports] =
    await Promise.all([
    invoke(C.SESSION_STATUS),
    invoke(C.BLOCKLIST_LIST),
    invoke(C.APPBLOCK_LIST),
    invoke(C.ALLOWAPP_LIST),
    invoke(C.VIDEO_GET),
    invoke(C.SETTINGS_GET),
    invoke(C.PROFILES_LIST),
    invoke(C.REPORTS_LIST),
  ]);

  renderStatus(status);
  renderBlocklist(blocklist);
  renderAppBlocklist(appBlocklist);
  renderAllowedAppList(allowedApps);
  renderProfiles(profiles);
  renderActivityReport(reports);
  renderNotesHeader(status.sessionNumber);
  el.videoUrlInput.value = videoUrl || "";
  el.sessionMinutesInput.value = settings.sessionMinutes;
  el.lockStopMinutesInput.value = settings.lockStopMinutes ?? 0;
  el.strictModeInput.checked = settings.strictMode;
  el.allowOnlyAppsInput.checked = Boolean(settings.allowOnlySelectedApps);
  el.appCloseWarningSecondsInput.value = settings.appCloseWarningSeconds ?? 5;
  renderAllowOnlyMode(Boolean(settings.allowOnlySelectedApps));

  const [draft, notes] = await Promise.all([
    invoke(C.NOTES_DRAFT_GET),
    invoke(C.NOTES_LIST),
  ]);
  if (el.notesInput && typeof draft?.text === "string") {
    el.notesInput.value = draft.text;
  }
  renderNotesHistory(notes);
}

el.addDomainButton.addEventListener("click", async () => {
  try {
    hideFeedback();
    const value = el.domainInput.value;
    const next = await invoke(C.BLOCKLIST_ADD, value);
    renderBlocklist(next);
    el.domainInput.value = "";
    showFeedback("Domain added.");
  } catch (error) {
    showError(error.message);
  }
});

el.saveVideoButton.addEventListener("click", async () => {
  try {
    await invoke(C.VIDEO_SET, el.videoUrlInput.value);
    showFeedback("Reminder video path saved.");
  } catch (error) {
    showError(error.message);
  }
});

el.addAppButton.addEventListener("click", async () => {
  try {
    const next = await invoke(C.APPBLOCK_ADD, el.appInput.value);
    renderAppBlocklist(next);
    el.appInput.value = "";
    showFeedback("App added to block list.");
  } catch (error) {
    showError(error.message);
  }
});

el.pickAppButton.addEventListener("click", async () => {
  try {
    const result = await invoke(C.APPBLOCK_PICK);
    if (result.canceled) {
      return;
    }
    renderAppBlocklist(result.list);
    showFeedback(`App added: ${result.app}`);
  } catch (error) {
    showError(error.message);
  }
});

el.addAllowedAppButton.addEventListener("click", async () => {
  try {
    const next = await invoke(C.ALLOWAPP_ADD, el.allowedAppInput.value);
    renderAllowedAppList(next);
    el.allowedAppInput.value = "";
    showFeedback("App added to allowed list.");
  } catch (error) {
    showError(error.message);
  }
});

el.pickAllowedAppButton.addEventListener("click", async () => {
  try {
    const result = await invoke(C.ALLOWAPP_PICK);
    if (result.canceled) {
      return;
    }
    renderAllowedAppList(result.list);
    showFeedback(`Allowed app added: ${result.app}`);
  } catch (error) {
    showError(error.message);
  }
});

el.allowOnlyAppsInput.addEventListener("change", async () => {
  try {
    // Toggle should not require hitting "Save Settings".
    const current = await invoke(C.SETTINGS_GET);
    const next = await invoke(C.SETTINGS_SET, {
      sessionMinutes: current.sessionMinutes,
      lockStopMinutes: current.lockStopMinutes,
      strictMode: current.strictMode,
      allowOnlySelectedApps: el.allowOnlyAppsInput.checked,
      appCloseWarningSeconds: Number(el.appCloseWarningSecondsInput.value || current.appCloseWarningSeconds || 5),
    });
    el.allowOnlyAppsInput.checked = Boolean(next.allowOnlySelectedApps);
    renderAllowOnlyMode(Boolean(next.allowOnlySelectedApps));
    showFeedback(`Allow-only mode ${next.allowOnlySelectedApps ? "enabled" : "disabled"}.`);
  } catch (error) {
    el.allowOnlyAppsInput.checked = false;
    renderAllowOnlyMode(false);
    showError(error.message);
  }
});

el.appCloseWarningSecondsInput.addEventListener("change", async () => {
  try {
    const current = await invoke(C.SETTINGS_GET);
    const seconds = Number(el.appCloseWarningSecondsInput.value);
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 60) {
      throw new Error("Warning seconds must be between 0 and 60.");
    }
    await invoke(C.SETTINGS_SET, {
      sessionMinutes: current.sessionMinutes,
      lockStopMinutes: current.lockStopMinutes,
      strictMode: current.strictMode,
      allowOnlySelectedApps: current.allowOnlySelectedApps,
      appCloseWarningSeconds: Math.floor(seconds),
    });
    showFeedback("Warning seconds saved.");
  } catch (error) {
    showError(error.message);
  }
});

el.pickVideoButton.addEventListener("click", async () => {
  try {
    const result = await invoke(C.VIDEO_PICK);
    if (result.canceled) {
      return;
    }
    el.videoUrlInput.value = result.path;
    showFeedback("Reminder video file selected.");
  } catch (error) {
    showError(error.message);
  }
});

el.testReminderButton.addEventListener("click", async () => {
  try {
    await invoke(C.REMINDER_TEST);
    showFeedback("Reminder popup triggered.");
  } catch (error) {
    showError(error.message);
  }
});

el.saveSettingsButton.addEventListener("click", async () => {
  try {
    const sessionMinutes = Number(el.sessionMinutesInput.value);
    const lockStopMinutes = Number(el.lockStopMinutesInput.value);
    const appCloseWarningSeconds = Number(el.appCloseWarningSecondsInput.value);
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
      throw new Error("Warning seconds must be between 0 and 60.");
    }
    const settings = await invoke(C.SETTINGS_SET, {
      sessionMinutes: Math.floor(sessionMinutes),
      lockStopMinutes: Math.floor(lockStopMinutes),
      strictMode: el.strictModeInput.checked,
      allowOnlySelectedApps: el.allowOnlyAppsInput.checked,
      appCloseWarningSeconds: Math.floor(appCloseWarningSeconds),
    });
    el.sessionMinutesInput.value = settings.sessionMinutes;
    el.lockStopMinutesInput.value = settings.lockStopMinutes;
    el.strictModeInput.checked = settings.strictMode;
    el.allowOnlyAppsInput.checked = Boolean(settings.allowOnlySelectedApps);
    el.appCloseWarningSecondsInput.value = settings.appCloseWarningSeconds ?? 5;
    renderAllowOnlyMode(Boolean(settings.allowOnlySelectedApps));
    showFeedback("Settings saved.");
  } catch (error) {
    showError(error.message);
  }
});

el.startSessionButton.addEventListener("click", async () => {
  setBusy(el.startSessionButton, true, "Starting...");
  try {
    const preflight = await invoke(C.SESSION_PREFLIGHT);
    if (preflight.allowOnlySelectedApps && preflight.willCloseApps?.length) {
      const seconds = preflight.appCloseWarningSeconds ?? 5;
      const msg = `Allow-only mode will close these apps after ~${seconds}s warning:\\n\\n- ${preflight.willCloseApps.join(
        "\\n- "
      )}\\n\\nContinue?`;
      if (!window.confirm(msg)) {
        showFeedback("Start cancelled.");
        return;
      }
    }
    const status = await invoke(C.SESSION_START);
    renderStatus(status);
    showFeedback("Deep work session started.");
  } catch (error) {
    showError(error.message);
  } finally {
    setBusy(el.startSessionButton, false);
  }
});

el.applyProfileButton.addEventListener("click", async () => {
  try {
    const id = el.profileSelect.value;
    if (!id) {
      throw new Error("Select a preset first.");
    }
    await invoke(C.PROFILES_APPLY, { id });
    await refreshInitialState();
    showFeedback("Preset applied.");
  } catch (error) {
    showError(error.message);
  }
});

el.saveProfileButton.addEventListener("click", async () => {
  try {
    const name = window.prompt("Preset name?");
    if (!name) {
      return;
    }
    await invoke(C.PROFILES_SAVE, { name });
    await refreshInitialState();
    showFeedback("Preset saved.");
  } catch (error) {
    showError(error.message);
  }
});

el.deleteProfileButton.addEventListener("click", async () => {
  try {
    const id = el.profileSelect.value;
    if (!id) {
      throw new Error("Select a preset first.");
    }
    if (!window.confirm("Delete selected preset?")) {
      return;
    }
    await invoke(C.PROFILES_DELETE, { id });
    await refreshInitialState();
    showFeedback("Preset deleted.");
  } catch (error) {
    showError(error.message);
  }
});

el.stopSessionButton.addEventListener("click", async () => {
  setBusy(el.stopSessionButton, true, "Stopping...");
  try {
    const status = await invoke(C.SESSION_STOP);
    renderStatus(status);
    showFeedback("Deep work session stopped.");
  } catch (error) {
    showError(error.message);
  } finally {
    setBusy(el.stopSessionButton, false);
  }
});

el.restoreBackupButton.addEventListener("click", async () => {
  try {
    await invoke(C.HOSTS_RESTORE);
    const status = await invoke(C.SESSION_STATUS);
    renderStatus(status);
    showFeedback("Hosts restored from backup.");
  } catch (error) {
    showError(error.message);
  }
});

el.restoreNowButton.addEventListener("click", async () => {
  try {
    await invoke(C.HOSTS_RESTORE);
    const status = await invoke(C.SESSION_STATUS);
    renderStatus(status);
    showFeedback("Browsing restored.");
  } catch (error) {
    showError(error.message);
  }
});

el.openLogsButton.addEventListener("click", async () => {
  try {
    const data = await invoke(C.LOGS_OPEN);
    showFeedback(`Opened logs: ${data.path}`);
  } catch (error) {
    showError(error.message);
  }
});

api.onSessionUpdated((status) => {
  renderStatus(status);
  renderNotesHeader(status.sessionNumber);
});

refreshInitialState().catch((error) => {
  showError(error.message);
});

let notesSaveTimer = null;
function scheduleNotesAutosave() {
  if (!el.notesInput) {
    return;
  }
  if (notesSaveTimer) {
    clearTimeout(notesSaveTimer);
  }
  notesSaveTimer = setTimeout(async () => {
    try {
      await invoke(C.NOTES_DRAFT_SET, { text: el.notesInput.value });
    } catch (_error) {
      // Keep typing even if autosave fails.
    }
  }, 500);
}

if (el.notesInput) {
  el.notesInput.addEventListener("input", scheduleNotesAutosave);
}

if (el.saveNotesButton) {
  el.saveNotesButton.addEventListener("click", async () => {
    try {
      const saved = await invoke(C.NOTES_SAVE, { text: el.notesInput.value });
      const notes = await invoke(C.NOTES_LIST);
      renderNotesHistory(notes);
      showFeedback(`Notes saved for session #${saved.sessionNumber}`);
    } catch (error) {
      showError(error.message);
    }
  });
}
