#!/usr/bin/env bash
# Copy the WSL working tree to C:\dev\ai-usage so the app can run with Windows Node/Electron.
# node_modules is excluded on both sides: Windows keeps its own native builds.
set -euo pipefail
src="$(cd "$(dirname "$0")/.." && pwd)/"
dest="${AI_USAGE_WIN_DIR:-/mnt/c/dev/ai-usage}/"
mkdir -p "$dest"
rsync -a --delete \
  --exclude node_modules --exclude out --exclude dist --exclude .git --exclude .superpowers \
  "$src" "$dest"
echo "synced → $dest  (PowerShell: cd C:\\dev\\ai-usage; npm install; npm run dev)"
