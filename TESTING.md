# DeepWork Testing Checklist

## Functional Tests

- [ ] Add `instagram.com` from control panel.
  - Expected: domain appears in list.
- [ ] Restart app.
  - Expected: `instagram.com` still listed.
- [ ] Start session.
  - Expected: macOS admin prompt appears.
  - Expected: `/etc/hosts` contains managed section with blocked entries.
- [ ] Verify blocked website in Safari and Chrome.
  - Expected: blocked sites fail to load, and DeepWork reminder popup appears.
- [ ] Click **Test Reminder Popup**.
  - Expected: always-on-top reminder popup opens.
- [ ] Pick a local video file from disk.
  - Expected: popup plays the selected local file.
- [ ] Enable **Allow only selected apps**, add one allowed app (e.g. VS Code), start session.
  - Expected: other running apps are closed automatically; DeepWork stays open.
- [ ] With allow-only mode ON and warning seconds = 5, open a disallowed app.
  - Expected: you get a warning (notification) and app closes after ~5 seconds.
- [ ] Save a preset, apply it, restart DeepWork, and confirm preset is still present.
  - Expected: presets persist; allow-only toggle defaults OFF on app launch.
- [ ] Complete a session, then check Activity Report section.
  - Expected: last session stats appear.
- [ ] Stop session.
  - Expected: managed hosts section removed.
  - Expected: sites are reachable again.
- [ ] Start session, then force quit app.
  - Expected after relaunch: recovery banner is visible.
- [ ] Click **Restore Now**.
  - Expected: hosts restored and banner disappears.
- [ ] Try invalid domain input (example: `abc`).
  - Expected: validation error shown in UI.
- [ ] Start session with empty video path.
  - Expected: session can start; reminder test shows guidance text.

## Safety Tests

- [ ] Confirm backup exists after apply/remove:
  - `/etc/hosts.deepwork.bak`
- [ ] Confirm restore operation:
  - Click **Restore from Backup**, verify `/etc/hosts` contents restored.
- [ ] Repeated start/stop cycles (5+ times).
  - Expected: no duplicate marker blocks in `/etc/hosts`.
