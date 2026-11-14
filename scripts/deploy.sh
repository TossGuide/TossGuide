#!/usr/bin/env bash
# BinSight one-command deploy (production build + leaderboard API + HTTPS tunnel).
#
#   scripts/deploy.sh               # update main, rebuild, restart the app, keep the tunnel (same link)
#   scripts/deploy.sh --new-tunnel  # same, but also restart the tunnel (you get a NEW link)
#
# What it does:
#   1. git checkout main && git pull (refuses if you have uncommitted changes)
#   2. npm install + production build (no test hook)
#   3. frees the port (stops our old server, and any Docker container publishing that port)
#   4. starts the server in tmux session "binsight"  ->  http://localhost:$PORT
#   5. starts a Cloudflare quick tunnel in tmux session "tunnel" (HTTPS link, needed for the
#      phone camera) and prints the link. The link stays the same until the tunnel restarts.
#
# Settings (env vars): PORT (8080), DATA_FILE (/var/lib/binsight/scans.json), REPO (repo root).
# Logs: tmux attach -t binsight  /  tmux attach -t tunnel   (detach: Ctrl+B then D)
set -euo pipefail

PORT="${PORT:-8080}"
DATA_FILE="${DATA_FILE:-/var/lib/binsight/scans.json}"
REPO="${REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
TUNNEL_LOG="${TUNNEL_LOG:-$HOME/.binsight-tunnel.log}"
NEW_TUNNEL=0
[[ "${1:-}" == "--new-tunnel" ]] && NEW_TUNNEL=1

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

command -v tmux >/dev/null || die "tmux is not installed (sudo apt install tmux)"
command -v cloudflared >/dev/null || die "cloudflared is not installed (see README > Deploy)"
command -v npm >/dev/null || die "npm/node not found on PATH"

cd "$REPO"

say "1/5 Updating code (main)"
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  git status --short --untracked-files=no
  die "You have uncommitted changes. Commit/stash them first."
fi
git checkout main
git pull --ff-only

say "2/5 Installing and building (production)"
npm install --no-audit --no-fund
env -u VITE_TEST_HOOK npm run build

say "3/5 Freeing port $PORT"
tmux kill-session -t binsight 2>/dev/null && echo "stopped old 'binsight' session" || true
if command -v docker >/dev/null; then
  for c in $(sudo docker ps -q --filter "publish=$PORT"); do
    name=$(sudo docker inspect -f '{{.Name}}' "$c" | tr -d /)
    echo "stopping Docker container '$name' (uses port $PORT; restart it later with: sudo docker start $name)"
    sudo docker update --restart=no "$c" >/dev/null
    sudo docker stop "$c" >/dev/null
  done
fi
sleep 1
if pids=$(sudo fuser "$PORT/tcp" 2>/dev/null) && [[ -n "${pids// /}" ]]; then
  echo "killing processes still on port $PORT: $pids"
  sudo fuser -k "$PORT/tcp" || true
  sleep 1
fi

say "4/5 Starting the server on port $PORT"
sudo mkdir -p "$(dirname "$DATA_FILE")"
sudo chown "$(id -u):$(id -g)" "$(dirname "$DATA_FILE")"
tmux new-session -d -s binsight -c "$REPO" \
  "PATH='$PATH' PORT='$PORT' DATA_FILE='$DATA_FILE' npm start; echo 'server exited'; read"
for _ in $(seq 1 30); do
  curl -fs "http://localhost:$PORT/api/health" >/dev/null && break
  sleep 1
done
curl -fs "http://localhost:$PORT/api/health" >/dev/null || die "server didn't start; run: tmux attach -t binsight"
echo "server is up: http://localhost:$PORT"

say "5/5 HTTPS tunnel"
if (( NEW_TUNNEL )) || ! tmux has-session -t tunnel 2>/dev/null; then
  tmux kill-session -t tunnel 2>/dev/null || true
  : > "$TUNNEL_LOG"
  tmux new-session -d -s tunnel \
    "cloudflared tunnel --no-autoupdate --url http://localhost:$PORT 2>&1 | tee '$TUNNEL_LOG'"
  echo "waiting for the tunnel link..."
  for _ in $(seq 1 60); do
    grep -qo 'https://[a-z0-9-]*\.trycloudflare\.com' "$TUNNEL_LOG" && break
    sleep 1
  done
else
  echo "tunnel already running: keeping the same link (use --new-tunnel to restart it)"
fi
URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$TUNNEL_LOG" | head -1 || true)
[[ -n "$URL" ]] || die "no tunnel link yet; run: tmux attach -t tunnel"
echo "$URL" > "$HOME/binsight-url.txt"

IP=$(curl -4 -fs -m 5 ifconfig.me || echo "<server-ip>")
cat <<EOF

  BinSight is live (commit $(git rev-parse --short HEAD) on main)

  Phone / judges (HTTPS, camera works):  $URL
  Direct (HTTP, no camera on phones):    http://$IP:$PORT
  Leaderboard data:                      $DATA_FILE

  Logs:  tmux attach -t binsight   |   tmux attach -t tunnel   (leave with Ctrl+B, then D)
  The link is also saved in ~/binsight-url.txt
EOF
