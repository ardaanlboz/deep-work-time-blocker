#!/usr/bin/env bash
set -euo pipefail

HOSTS_FILE="/etc/hosts"
BACKUP_FILE="/etc/hosts.deepwork.bak"
TIMESTAMP_BACKUP="/etc/hosts.deepwork.$(date +%Y%m%d%H%M%S).bak"

cp "$HOSTS_FILE" "$BACKUP_FILE"
cp "$HOSTS_FILE" "$TIMESTAMP_BACKUP"
echo "Backups created: $BACKUP_FILE, $TIMESTAMP_BACKUP"
