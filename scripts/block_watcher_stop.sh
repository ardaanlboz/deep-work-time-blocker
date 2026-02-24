#!/usr/bin/env bash
set -euo pipefail

PID_FILE="/tmp/deepwork_block_watcher.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "Block watcher not running."
  exit 0
fi

PID="$(cat "$PID_FILE" || true)"
if [[ -n "${PID:-}" ]] && kill -0 "$PID" 2>/dev/null; then
  kill "$PID" 2>/dev/null || true
fi

rm -f "$PID_FILE"
echo "Block watcher stopped."
