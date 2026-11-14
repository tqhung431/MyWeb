@echo off
rem Nook, 1-click start for Windows: double-click this file.
rem Needs Docker Desktop installed and running. Settings: .env (made from .env.example the first time).
cd /d "%~dp0"

docker info >nul 2>&1
if errorlevel 1 (
  echo Docker isn't running. Open Docker Desktop, wait until it says "running", then try again.
  pause
  exit /b 1
)

if not exist .env (
  copy .env.example .env >nul
  echo Created .env from .env.example. Edit it to change the AI, monitoring or remote access.
  rem Stage 20: a brand-new install gets a random database password instead of "nook"
  rem (only if there's no database yet: an existing one keeps the password it was created with).
  docker volume inspect nook_db-data >nul 2>&1
  if errorlevel 1 (
    powershell -NoProfile -Command "$b = New-Object byte[] 18; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); $pw = [Convert]::ToBase64String($b) -replace '[+/=]', 'x'; $f = Join-Path (Get-Location) '.env'; $t = [IO.File]::ReadAllText($f) -replace '(?m)^POSTGRES_PASSWORD=.*$', ('POSTGRES_PASSWORD=' + $pw); [IO.File]::WriteAllText($f, $t)"
    echo Made a random database password ^(it's in .env; keep that file safe^).
  )
)

echo Starting Nook... the first time takes 5-10 minutes.
docker compose up -d --build
if errorlevel 1 (
  echo.
  echo Something went wrong. See the messages above, or run: docker compose logs api
  pause
  exit /b 1
)
rem Caddy reads the Caddyfile through a file mount: after a git pull a running Caddy still has the old one.
rem Recreate it (a second or two) so new routes, like /api/arena for the game server, always take effect.
docker compose up -d --no-deps --force-recreate caddy

echo.
echo Nook is running: https://localhost  (other PCs: http://^<this PC's IP^>)
echo To stop it: docker compose down
start "" https://localhost
pause
