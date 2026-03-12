@echo off
title Postiz - Stopping...
color 0E

echo ============================================
echo          POSTIZ - Shutdown
echo ============================================
echo.

cd /d "%~dp0"

echo [1/2] Stopping Docker services...
echo.
docker compose -f docker/docker-compose.dev.yaml down
echo.

echo [2/2] Killing any remaining Node processes for this project...
echo.
:: Kill any node processes running from this directory
taskkill /f /im node.exe >nul 2>&1
echo  Done.
echo.

echo ============================================
echo  Everything is stopped.
echo ============================================
echo.
timeout /t 3
