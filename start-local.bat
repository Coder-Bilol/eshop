@echo off
setlocal

set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

if /i "%~1"=="--terminal" goto run_local
if defined WT_SESSION goto run_local

where wt.exe >nul 2>&1
if errorlevel 1 goto run_local

wt.exe -w "EshopLocal" new-tab --title "Eshop Local" --startingDirectory "%PROJECT_DIR%" cmd.exe /d /k call "%~nx0" --terminal
exit /b 0

:run_local
cd /d "%~dp0"
title Eshop Local Development

echo.
echo Eshop local development
echo ======================
echo Storefront:     http://localhost:3000
echo Backend:        http://localhost:9000
echo Backend health: http://localhost:9000/health
echo Medusa Admin:   http://localhost:9000/app
echo.
echo Starting backend and storefront...
echo Stop both services with Ctrl+C.
echo.

call npm run dev:local:watch
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
  echo Local development stopped with exit code %EXIT_CODE%.
) else (
  echo Local development stopped.
)

pause
exit /b %EXIT_CODE%
