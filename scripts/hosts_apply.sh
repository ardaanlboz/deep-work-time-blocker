#!/usr/bin/env bash
set -euo pipefail

HOSTS_FILE="/etc/hosts"
BACKUP_FILE="/etc/hosts.deepwork.bak"
TIMESTAMP_BACKUP="/etc/hosts.deepwork.$(date +%Y%m%d%H%M%S).bak"
BLOCKLIST_FILE="${1:-}"
MARKER_START="# DEEPWORK BLOCK START"
MARKER_END="# DEEPWORK BLOCK END"

if [[ -z "$BLOCKLIST_FILE" || ! -f "$BLOCKLIST_FILE" ]]; then
  echo "Missing blocklist file argument." >&2
  exit 1
fi

cp "$HOSTS_FILE" "$BACKUP_FILE"
cp "$HOSTS_FILE" "$TIMESTAMP_BACKUP"

TMP_FILE="$(mktemp)"

awk -v start="$MARKER_START" -v end="$MARKER_END" '
  $0 == start { inblock=1; next }
  $0 == end   { inblock=0; next }
  !inblock { print $0 }
' "$HOSTS_FILE" > "$TMP_FILE"

{
  echo ""
  echo "$MARKER_START"
  while IFS= read -r domain; do
    trimmed="$(echo "$domain" | tr -d "[:space:]")"
    if [[ -n "$trimmed" ]]; then
      echo "127.0.0.1 $trimmed"
    fi
  done < "$BLOCKLIST_FILE"
  echo "$MARKER_END"
  echo ""
} >> "$TMP_FILE"

cp "$TMP_FILE" "$HOSTS_FILE"
rm -f "$TMP_FILE"
echo "Hosts apply complete."
