#!/usr/bin/env bash
set -euo pipefail

HIT_LOG_PATH="${1:-}"
PID_FILE="/tmp/deepwork_block_watcher.pid"
LOG_FILE="/tmp/deepwork_block_watcher.log"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PY_SCRIPT="$SCRIPT_DIR/block_hit_watcher.py"
PYTHON_BIN=""

if [[ -z "$HIT_LOG_PATH" ]]; then
  echo "Missing hit log path argument." >&2
  exit 1
fi

if [[ ! -f "$PY_SCRIPT" ]]; then
  echo "Watcher script missing: $PY_SCRIPT" >&2
  exit 1
fi

touch "$HIT_LOG_PATH"

if [[ -x "/usr/bin/python3" ]]; then
  PYTHON_BIN="/usr/bin/python3"
elif [[ -x "/opt/homebrew/bin/python3" ]]; then
  PYTHON_BIN="/opt/homebrew/bin/python3"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python3)"
else
  echo "python3 not found (required to run block watcher)." >&2
  exit 1
fi

{
  echo "=== DeepWork block watcher start ==="
  echo "time: $(date '+%Y-%m-%dT%H:%M:%S%z')"
  echo "uid: $(id -u) user: $(id -un 2>/dev/null || true)"
  echo "python: $PYTHON_BIN"
  echo "script: $PY_SCRIPT"
  echo "hit_log: $HIT_LOG_PATH"
} > "$LOG_FILE"

if [[ -f "$PID_FILE" ]]; then
  OLD_PID="$(cat "$PID_FILE" || true)"
  if [[ -n "${OLD_PID:-}" ]] && kill -0 "$OLD_PID" 2>/dev/null; then
    kill "$OLD_PID" 2>/dev/null || true
    sleep 0.2
  fi
  rm -f "$PID_FILE"
fi

"$PYTHON_BIN" "$PY_SCRIPT" "$HIT_LOG_PATH" </dev/null >>"$LOG_FILE" 2>&1 &
NEW_PID=$!
echo "$NEW_PID" > "$PID_FILE"
sleep 0.4
if ! kill -0 "$NEW_PID" 2>/dev/null; then
  echo "Failed to start block watcher. Check $LOG_FILE." >&2
  exit 1
fi

echo "Block watcher started with pid $NEW_PID"
