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
  echo Created .env from .env.example. Edit it to change the password, the AI or monitoring.
)

echo Starting Nook... the first time takes 5-10 minutes.
docker compose up -d --build
if errorlevel 1 (
  echo.
  echo Something went wrong. See the messages above, or run: docker compose logs api
  pause
  exit /b 1
)

echo.
echo Nook is running: https://localhost  (other PCs: http://^<this PC's IP^>)
echo To stop it: docker compose down
start "" https://localhost
pause
