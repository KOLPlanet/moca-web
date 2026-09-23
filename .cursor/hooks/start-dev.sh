#!/usr/bin/env bash
# Idempotent local Astro dev server starter for Cursor hooks / folder-open tasks.
# Uses a detached Node child so the process survives after the hook exits.
set -euo pipefail

ROOT="${CURSOR_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
PORT=4321
URL="http://localhost:${PORT}/"
LOG_FILE="/tmp/moca-web-dev.log"
PID_FILE="/tmp/moca-web-dev.pid"

export PATH="/usr/local/bin:/opt/homebrew/bin:${HOME}/.nvm/versions/node/$(ls "${HOME}/.nvm/versions/node" 2>/dev/null | tail -1)/bin:${PATH}"

cd "$ROOT"

respond() {
  local status="$1"
  if [[ -n "${CURSOR_VERSION:-}" ]]; then
    printf '%s\n' "{\"env\":{\"MOCA_DEV_URL\":\"${URL}\"},\"additional_context\":\"Local Astro dev server ${status} at ${URL}\"}"
  fi
}

port_in_use() {
  /usr/sbin/lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1
}

if port_in_use; then
  respond "already running"
  exit 0
fi

if [[ ! -d node_modules ]]; then
  respond "skipped (run npm install first)"
  exit 0
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  respond "skipped (node/npm not found)"
  exit 0
fi

# Fully detach so Cursor hooks cannot reap the child when the hook exits.
MOCA_ROOT="$ROOT" MOCA_LOG="$LOG_FILE" MOCA_PID="$PID_FILE" node <<'NODE'
const { spawn } = require("child_process");
const fs = require("fs");
const root = process.env.MOCA_ROOT;
const log = process.env.MOCA_LOG;
const pidFile = process.env.MOCA_PID;
const out = fs.openSync(log, "a");
const child = spawn("npm", ["run", "dev"], {
  cwd: root,
  detached: true,
  stdio: ["ignore", out, out],
  env: process.env,
});
fs.writeFileSync(pidFile, String(child.pid));
child.unref();
NODE

for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if port_in_use; then
    respond "started"
    exit 0
  fi
  sleep 0.4
done

respond "starting (see ${LOG_FILE})"
exit 0
