@echo off
echo ========================================================
echo   Starting Mini Operations ERP (Backend + Frontend)
echo ========================================================

start cmd /k "cd backend && npm.cmd run dev"
timeout /t 3 > nul
start cmd /k "cd frontend && npm.cmd run dev"

echo.
echo Backend running at http://localhost:5000 (Swagger: /api/docs)
echo Frontend running at http://localhost:5173
echo.
