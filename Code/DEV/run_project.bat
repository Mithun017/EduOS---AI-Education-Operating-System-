@echo off
cd /d "%~dp0"
title EduOS Startup Runner
echo ==========================================
echo       🎓 Starting EduOS Project 🎓
echo ==========================================
echo.

:: Verify environment
if not exist "%~dp0backend\venv\Scripts\python.exe" (
    echo ❌ Python virtual environment not found.
    echo Please run 'setup_project.bat' first to install all dependencies.
    echo.
    pause
    exit /b
)

if not exist "%~dp0frontend\node_modules" (
    echo ❌ Frontend node_modules not found.
    echo Please run 'setup_project.bat' first to install all dependencies.
    echo.
    pause
    exit /b
)

echo Starting FastAPI Backend Server in a new window...
start "EduOS Backend Server" cmd /k "cd /d "%~dp0backend" && call venv\Scripts\activate && python -m uvicorn app.main:app --reload --port 8000"

echo Starting React + Vite Frontend Server in a new window...
start "EduOS Frontend Dev Server" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ==========================================
echo 🚀 Both servers are starting up!
echo - Backend will run at: http://127.0.0.1:8000
echo - Frontend will run at: http://localhost:5173
echo ==========================================
echo.
echo 🌐 Opening Frontend in your default browser in 5 seconds...
ping 127.0.0.1 -n 4 >nul
start http://localhost:5173

pause
