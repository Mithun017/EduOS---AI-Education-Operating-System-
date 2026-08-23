@echo off
title EduOS API & Key Health Checker
cls
echo ============================================================
echo           EduOS AI & Cloud Storage Key Diagnostic
echo ============================================================
echo.

IF EXIST "..\backend\venv\Scripts\python.exe" (
    "..\backend\venv\Scripts\python.exe" test_all_apis.py
) ELSE (
    python test_all_apis.py
)

echo.
echo ============================================================
echo Testing Completed. Press any key to exit.
echo ============================================================
pause
