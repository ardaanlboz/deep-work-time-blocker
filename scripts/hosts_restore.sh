#!/usr/bin/env bash
set -euo pipefail

HOSTS_FILE="/etc/hosts"
BACKUP_FILE="${1:-/etc/hosts.deepwork.bak}"

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found at $BACKUP_FILE" >&2
  exit 1
fi

cp "$BACKUP_FILE" "$HOSTS_FILE"
echo "Hosts file restored from backup."
