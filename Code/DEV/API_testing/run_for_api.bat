@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title EduOS API Diagnostic & Playground Runner
cls

echo ============================================================
echo      🎓 EduOS AI & Cloud API Suite 🎓
echo ============================================================
echo.
echo Select an option:
echo   [1] Run CLI Diagnostic Health Checks (test_all_apis.py)
echo   [2] Launch Streamlit Interactive API Playground GUI (app.py)
echo.
set /p choice="Enter choice (1 or 2): "

if "%choice%"=="1" (
    echo.
    echo Running CLI Diagnostic Checks...
    if exist "..\backend\venv\Scripts\python.exe" (
        "..\backend\venv\Scripts\python.exe" test_all_apis.py
    ) else (
        python test_all_apis.py
    )
) else if "%choice%"=="2" (
    echo.
    echo Launching Streamlit Interactive Playground on http://localhost:8501...
    if exist "..\backend\venv\Scripts\streamlit.exe" (
        "..\backend\venv\Scripts\streamlit.exe" run app.py --server.port 8501
    ) else (
        streamlit run app.py --server.port 8501
    )
) else (
    echo.
    echo ❌ Invalid choice selected.
)

echo.
echo ============================================================
echo Execution Finished. Press any key to exit.
echo ============================================================
pause
