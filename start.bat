@echo off
setlocal enabledelayedexpansion
title Postiz - Starting...
color 0A

echo ============================================
echo          POSTIZ - Local Dev Launcher
echo ============================================
echo.

:: Get the directory where this script lives
cd /d "%~dp0"

echo [1/7] Checking prerequisites...
echo.

:: Check if docker command exists at all
where docker >nul 2>&1
if !errorlevel! neq 0 (
    color 0C
    echo  ERROR: Docker is not installed or not in PATH!
    echo  Install Docker Desktop from https://www.docker.com/products/docker-desktop
    echo.
    pause
    exit /b 1
)

:: Check Docker — auto-launch if not running
docker info >nul 2>&1
if !errorlevel! neq 0 (
    echo  Docker is not running. Launching Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo  Waiting for Docker to be ready ^(this can take 30-60 seconds^)...
)

:wait_docker
docker info >nul 2>&1
if !errorlevel! neq 0 (
    echo  Still waiting for Docker...
    timeout /t 3 /nobreak >nul
    goto wait_docker
)
echo  [OK] Docker is running

:: Check Node
where node >nul 2>&1
if !errorlevel! neq 0 (
    color 0C
    echo  ERROR: Node.js is not installed or not in PATH!
    echo  Install Node.js 22+ from https://nodejs.org
    echo.
    pause
    exit /b 1
)
echo  [OK] Node.js found

:: Check pnpm
where pnpm >nul 2>&1
if !errorlevel! neq 0 (
    color 0C
    echo  ERROR: pnpm is not installed!
    echo  Run: npm install -g pnpm
    echo.
    pause
    exit /b 1
)
echo  [OK] pnpm found
echo.

echo [2/7] Starting Docker services (PostgreSQL, Redis, MinIO, Temporal)...
echo.
docker compose -f docker/docker-compose.dev.yaml up -d
if !errorlevel! neq 0 (
    color 0C
    echo.
    echo  ERROR: Docker compose failed!
    echo  Check the error message above for details.
    echo.
    pause
    exit /b 1
)
echo.

echo [3/7] Waiting for databases to be ready...
echo.

:: Wait for PostgreSQL
:wait_pg
docker exec postiz-postgres pg_isready -U postiz-user -d postiz-db-local >nul 2>&1
if !errorlevel! neq 0 (
    echo  Waiting for PostgreSQL...
    timeout /t 2 /nobreak >nul
    goto wait_pg
)
echo  [OK] PostgreSQL is ready

:: Wait for Redis
:wait_redis
docker exec postiz-redis redis-cli ping >nul 2>&1
if !errorlevel! neq 0 (
    echo  Waiting for Redis...
    timeout /t 2 /nobreak >nul
    goto wait_redis
)
echo  [OK] Redis is ready
echo.

echo [4/7] Installing dependencies (if needed)...
echo.

:: Clear Prisma generated client to avoid EPERM file lock issues on Windows
if exist "node_modules\.prisma\client" (
    echo  Clearing Prisma client cache to avoid file lock issues...
    rmdir /s /q "node_modules\.prisma\client" >nul 2>&1
)

:: Use --ignore-scripts to avoid postinstall prisma generate race condition on Windows
call pnpm install --frozen-lockfile --ignore-scripts 2>nul || call pnpm install --ignore-scripts
if !errorlevel! neq 0 (
    color 0C
    echo.
    echo  ERROR: pnpm install failed!
    echo  Try closing any IDE or editor that might lock node_modules files,
    echo  then run start.bat again.
    echo.
    pause
    exit /b 1
)
echo.

echo [5/7] Generating Prisma client...
echo.
call npx prisma@6.5.0 generate --schema ./libraries/nestjs-libraries/src/database/prisma/schema.prisma
if !errorlevel! neq 0 (
    color 0C
    echo.
    echo  ERROR: Prisma client generation failed!
    echo.
    pause
    exit /b 1
)
echo.

echo [6/7] Pushing database schema...
echo.
call pnpm run prisma-db-push
if !errorlevel! neq 0 (
    color 0C
    echo.
    echo  ERROR: Prisma database push failed!
    echo.
    pause
    exit /b 1
)
echo.

echo [7/7] Starting all dev servers...
echo.
echo  Backend    = http://localhost:3500
echo  Frontend   = http://localhost:4200
echo  Temporal   = http://localhost:8080
echo  MinIO      = http://localhost:9001
echo.
echo ============================================
echo  Postiz is starting! This window will show
echo  all server logs. Close this window or press
echo  Ctrl+C to stop the dev servers.
echo.
echo  To stop EVERYTHING (including Docker),
echo  double-click: stop.bat
echo ============================================
echo.

title Postiz - Running

:: Open the frontend in the browser after a short delay
start "" cmd /c "timeout /t 10 /nobreak >nul && start http://localhost:4200"

call pnpm run dev

:: If we get here, pnpm run dev exited (crash or Ctrl+C)
echo.
echo ============================================
echo  Dev servers stopped.
echo ============================================
echo.
pause
