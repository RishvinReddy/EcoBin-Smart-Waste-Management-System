@echo off
setlocal enabledelayedexpansion
title Smart Waste Management Platform — Hyderabad
color 0A
echo =================================================================
echo   AI-Powered Smart Waste Management Platform
echo   Municipal Corporation of Hyderabad
echo   Version 2.0 — Production Ready
echo =================================================================
echo.

:: Check for command line argument to bypass prompt
set network_mode=%1
if "%network_mode%"=="" (
    set /p network_mode="Do you want to run this on the local network (accessible to other devices)? (Y/N): "
)

if /i "%network_mode%"=="Y" (
    set BACKEND_HOST=0.0.0.0
    set FRONTEND_ARGS=-- --host
    echo [INFO] Running in Network Mode
) else (
    set BACKEND_HOST=127.0.0.1
    set FRONTEND_ARGS=
    echo [INFO] Running in Local Mode
)
echo.

:: Check for Node.js
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js / npm is not installed or not in PATH. Please install Node.js.
    pause
    exit /b 1
)

:: Check for Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH. Please install Python.
    pause
    exit /b 1
)

:: Check if virtual environment exists
if not exist ".venv\Scripts\activate" (
    echo [SETUP] Creating Python virtual environment...
    python -m venv .venv
)

call .venv\Scripts\activate

echo [SETUP] Verifying/installing Python dependencies (requirements.txt)...
pip install -r requirements.txt

echo.
echo [SETUP] Verifying database schema and models...
python run_pipeline.py

echo.
echo [SETUP] Verifying/installing Node dependencies (frontend)...
if exist "frontend\package.json" (
    cd frontend
    call npm install
    cd ..
) else (
    echo [WARNING] frontend\package.json not found. Skipping npm install.
)

echo.
echo =================================================================
echo   Starting Services...
echo =================================================================
echo.

:: 1. Launch FastAPI Backend
echo [1/2] Launching FastAPI Backend (Port 8000)...
start "EcoBin Backend — AI Routing API" cmd /k ^
    "call .venv\Scripts\activate && echo Backend starting... && python -m uvicorn backend.main:app --reload --host %BACKEND_HOST% --port 8000"

:: Wait 2 seconds for backend to start
timeout /t 2 /nobreak > nul

:: 2. Launch React Frontend
echo [2/2] Launching React Dashboard (Port 5173)...
start "EcoBin Frontend — Live Dashboard" cmd /k ^
    "cd frontend && npm run dev %FRONTEND_ARGS%"

:: Wait a moment for Vite to start before opening browser tabs
echo Waiting for Frontend to initialize...
timeout /t 4 /nobreak > nul

echo Opening Dashboards in default browser...
start http://localhost:5173/
start http://localhost:5173/maintenance
start http://localhost:5173/driver

echo.
echo =================================================================
echo   PLATFORM LAUNCHED SUCCESSFULLY!
echo =================================================================
echo.
echo   Main Dashboard:    http://localhost:5173
echo   Maintenance:       http://localhost:5173/maintenance
echo   Driver Dashboard:  http://localhost:5173/driver
echo.
if /i "%network_mode%"=="Y" (
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr IPv4') do (
        set ip=%%a
        set LOCAL_IP=!ip:~1!
    )
    echo   NOTE: Network Mode is ON. Access via your machine's IP address on Port 5173.
    echo   Network Dashboard: http://!LOCAL_IP!:5173
    echo   Network Maint:     http://!LOCAL_IP!:5173/maintenance
    echo   Network Driver:    http://!LOCAL_IP!:5173/driver
    echo.
)
echo   API Swagger Docs:  http://127.0.0.1:8000/docs
echo   WebSocket Live:    ws://127.0.0.1:8000/ws/live
echo.
echo   (Close this window — servers will keep running)
pause > nul
