#!/usr/bin/env bash
# Mac/Linux version of live.ps1: pulls the latest changes every 10 seconds.
cd "$(dirname "$0")/.."
echo "Watching for updates... (Ctrl+C to stop)"
while true; do
  b=$(git rev-parse HEAD); git pull --ff-only --quiet 2>/dev/null; a=$(git rev-parse HEAD)
  if [ "$b" != "$a" ]; then
    echo "[$(date +%H:%M:%S)] Updated: $(git log -1 --pretty=%s)"
    if git diff --name-only "$b" "$a" | grep -q "app/package.json"; then (cd app && npm install --no-fund --no-audit); echo "New packages: restart npx expo start"; fi
  fi
  sleep 10
done
