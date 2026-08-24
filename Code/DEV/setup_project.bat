@echo off
cd /d "%~dp0"
title EduOS Project Setup
echo ==========================================
echo       🎓 EduOS Prototype Setup 🎓
echo ==========================================
echo.

:: Check for Python
echo [1/5] Checking Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python is not installed or not added to PATH.
    echo Please install Python 3.10+ and try again.
    pause
    exit /b
)
echo Python is installed.
echo.

:: Check for Node.js
echo [2/5] Checking Node.js installation...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed or not added to PATH.
    echo Please install Node.js and try again.
    pause
    exit /b
)
echo Node.js is installed.
echo.

:: Configure Backend environment
echo [3/5] Setting up Backend environment...
cd /d "%~dp0backend"
if not exist .env (
    if exist "%~dp0.env.example" (
        echo Copying .env from template...
        copy "%~dp0.env.example" .env
    ) else (
        echo Creating a default .env file...
        echo NVIDIA_NIM_API_KEY=> .env
        echo NVIDIA_NIM_BASE_URL=https://integrate.api.nvidia.com/v1>> .env
        echo GOOGLE_GEMINI_API_KEY=>> .env
        echo GROQ_API_KEY=>> .env
        echo TAVILY_API_KEY=>> .env
        echo DATABASE_URL=sqlite+aiosqlite:///./eduos.db>> .env
        echo REDIS_URL=redis://localhost:6379/0>> .env
        echo JWT_SECRET_KEY=e838e55e8bd8cfad62e5b721868351e9ebbc0e0c3755cfde9103c80e1ea71f54>> .env
        echo JWT_ALGORITHM=HS256>> .env
        echo JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30>> .env
        echo JWT_REFRESH_TOKEN_EXPIRE_DAYS=7>> .env
        echo APP_ENV=development>> .env
        echo APP_HOST=0.0.0.0>> .env
        echo APP_PORT=8000>> .env
    )
)

:: Create Virtual Environment
if not exist venv (
    echo Creating Python virtual environment...
    python -m venv venv
) else (
    echo Virtual environment already exists.
)

echo Installing backend dependencies...
call venv\Scripts\pip install -r requirements.txt

echo Seeding database...
call venv\Scripts\python -m app.db.seed
cd /d "%~dp0"
echo.

:: Configure Frontend environment
echo [4/5] Setting up Frontend environment...
cd /d "%~dp0frontend"
echo Installing frontend dependencies (npm install)...
call npm install
cd /d "%~dp0"
echo.

echo [5/5] Setup Completed Successfully!
echo ==========================================
echo To start both backend and frontend servers, run:
echo   run_project.bat
echo ==========================================
echo.
pause
