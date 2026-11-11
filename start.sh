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
  echo "Created .env from .env.example. Edit it to change the password, the AI or monitoring."
fi

echo "Starting Nook... the first time takes 5-10 minutes."
if ! docker compose up -d --build; then
  echo
  echo "Something went wrong. See the messages above, or run: docker compose logs api"
  exit 1
fi

echo
echo "Nook is running: https://localhost  (other PCs: http://<this PC's IP>)"
echo "To stop it: docker compose down"
