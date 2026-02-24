#!/usr/bin/env bash
set -euo pipefail

HOSTS_FILE="/etc/hosts"
BACKUP_FILE="/etc/hosts.deepwork.bak"
TIMESTAMP_BACKUP="/etc/hosts.deepwork.$(date +%Y%m%d%H%M%S).bak"
MARKER_START="# DEEPWORK BLOCK START"
MARKER_END="# DEEPWORK BLOCK END"

cp "$HOSTS_FILE" "$BACKUP_FILE"
cp "$HOSTS_FILE" "$TIMESTAMP_BACKUP"

TMP_FILE="$(mktemp)"

awk -v start="$MARKER_START" -v end="$MARKER_END" '
  $0 == start { inblock=1; next }
  $0 == end   { inblock=0; next }
  !inblock { print $0 }
' "$HOSTS_FILE" > "$TMP_FILE"

cp "$TMP_FILE" "$HOSTS_FILE"
rm -f "$TMP_FILE"
echo "Hosts remove complete."
