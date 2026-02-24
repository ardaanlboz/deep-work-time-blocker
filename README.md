# DeepWork (Electron, macOS)

DeepWork is a macOS Electron control panel that manages deep work sessions by:
- blocking selected websites through a managed `/etc/hosts` section,
- showing always-on-top reminder popups with your local video file,
- restoring hosts safely via backups and recovery actions.

## Privilege Strategy

This app uses **`sudo-prompt`** (Option A) for admin operations.

When you click **Start Session**, **Stop Session**, or **Restore from Backup**, DeepWork runs shell scripts with a native macOS admin prompt. The Electron app itself remains a normal user process.

## Features Included

- Start/stop deep work session.
- Persistent blocklist management (add/remove/list).
- Persistent app blocking list for macOS apps (add/remove/pick).
- Local reminder video file select/set + test reminder popup.
- Session settings: duration, stop-lock window, strict mode.
- Session setting: allow-only selected apps (closes all other foreground apps).
- Managed hosts markers:
  - `# DEEPWORK BLOCK START`
  - `# DEEPWORK BLOCK END`
- Automatic hosts backup before apply/remove.
- Recovery banner on next launch if previous session was active.
- Open logs from UI.

## Project Structure

- `src/main/`
  - `index.js` - app bootstrap
  - `ipc.js` - renderer/main contract
  - `session.js` - start/stop/timer/recovery logic
  - `hostsManager.js` - privileged hosts orchestration
  - `reminderWindow.js` - always-on-top popup
  - `config.js` - persistence + zod validation
  - `logger.js` - electron-log setup
  - `privileges.js` - sudo-prompt bridge
  - `preload.js` - secure renderer API bridge
- `src/renderer/`
  - `index.html`, `styles.css`, `app.js`
- `scripts/`
  - `hosts_apply.sh`, `hosts_remove.sh`, `hosts_backup.sh`, `hosts_restore.sh`, `dns_flush.sh`
  - `block_hit_watcher.py`, `block_watcher_start.sh`, `block_watcher_stop.sh`

## Run (Development)

1. Install dependencies:
   - `npm install`
2. Start the app:
   - `npm start`
3. Use the control panel.

> First hosts operation will request macOS admin password.

## Build (macOS)

- `npm run build`

Outputs are written to `dist/` (`.dmg` and `.zip`).

## Safety Notes

- DeepWork only edits text inside the managed markers in `/etc/hosts`.
- Each apply/remove operation creates:
  - `/etc/hosts.deepwork.bak`
  - timestamped backup files: `/etc/hosts.deepwork.YYYYMMDDHHMMSS.bak`
- If session ends unexpectedly, use **Restore Now** from the recovery banner.
