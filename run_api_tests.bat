@echo off
setlocal
cd /d "%~dp0"
title EduOS API Key Health Checker
cls
echo ============================================================
echo           EduOS AI ^& Cloud Storage Key Diagnostic
echo ============================================================
echo.

IF EXIST "Code\DEV\backend\venv\Scripts\python.exe" (
    "Code\DEV\backend\venv\Scripts\python.exe" "Code\DEV\API_testing\test_all_apis.py"
) ELSE IF EXIST "Code\DEV\API_testing\run_api_tests.bat" (
    cd /d "%~dp0Code\DEV\API_testing"
    "..\backend\venv\Scripts\python.exe" test_all_apis.py
) ELSE (
    python test_all_apis.py
)

echo.
echo ============================================================
echo Testing Completed. Press any key to exit.
echo ============================================================
pause
