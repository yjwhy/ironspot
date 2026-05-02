#!/usr/bin/env bash
#
# Capture a PNG of the currently booted iOS simulator and print its path.
# Used as part of the AI-assisted dev workflow so the agent can read the
# screen directly via the Read tool instead of waiting for human screenshots.
#
# Output goes to .tmp/snaps/<HHMMSS>.png (gitignored). The path is echoed
# so callers can pipe it into other commands.
#
# Usage:
#   ./scripts/snap.sh                 # writes .tmp/snaps/<HHMMSS>.png
#   ./scripts/snap.sh path/out.png    # writes to the given path

set -euo pipefail

if ! command -v xcrun >/dev/null 2>&1; then
  echo "xcrun not found. Install Xcode command line tools." >&2
  exit 1
fi

if ! xcrun simctl list devices booted | grep -q Booted; then
  echo "No booted iOS simulator. Boot one first (e.g. via 'pnpm expo start --dev-client' then press i)." >&2
  exit 1
fi

if [[ $# -ge 1 ]]; then
  out="$1"
  mkdir -p "$(dirname "$out")"
else
  mkdir -p .tmp/snaps
  out=".tmp/snaps/$(date +%H%M%S).png"
fi

xcrun simctl io booted screenshot "$out" >/dev/null
echo "$out"
