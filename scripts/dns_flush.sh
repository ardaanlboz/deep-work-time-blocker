#!/usr/bin/env bash
set -euo pipefail

dscacheutil -flushcache || true
killall -HUP mDNSResponder || true
echo "DNS flush command completed."
