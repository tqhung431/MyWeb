#!/usr/bin/env sh
# Nook, 1-click start for macOS and Linux:  ./start.sh
# Needs Docker installed and running. Settings: .env (made from .env.example the first time).
set -e
cd "$(dirname "$0")"

if ! docker info >/dev/null 2>&1; then
  echo "Docker isn't running. Start Docker (Desktop), then try again."
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example. Edit it to change the AI, monitoring or remote access."
  # Stage 20: a brand-new install gets a random database password instead of "nook".
  # (Only if there's no database yet: an existing one keeps the password it was created with.)
  if ! docker volume inspect nook_db-data >/dev/null 2>&1; then
    pw=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24)
    sed -i.bak "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$pw/" .env && rm -f .env.bak
    echo "Made a random database password (it's in .env; keep that file safe)."
  fi
fi

echo "Starting Nook... the first time takes 5-10 minutes."
if ! docker compose up -d --build; then
  echo
  echo "Something went wrong. See the messages above, or run: docker compose logs api"
  exit 1
fi
# Caddy reads the Caddyfile through a file mount: after a git pull a running Caddy still has the old one.
# Recreate it (a second or two) so new routes, like /api/arena for the game server, always take effect.
docker compose up -d --no-deps --force-recreate caddy

echo
echo "Nook is running: https://localhost  (other PCs: http://<this PC's IP>)"
echo "To stop it: docker compose down"
