@echo off
setlocal enabledelayedexpansion
title ORATIONAL - Push to GitHub

echo =======================================================
echo          ORATIONAL - Push to GitHub Repository
echo =======================================================
echo.

set "PATH=C:\Users\offic\bin\git\cmd;%PATH%"

where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git is not found in PATH.
    pause
    exit /b 1
)

echo Current Git Status:
git status -s
echo.

set /p REPO_URL="Enter your GitHub Repository URL (e.g. https://github.com/username/repo.git): "

if "%REPO_URL%"=="" (
    echo [ERROR] No repository URL provided. Aborted.
    pause
    exit /b 1
)

echo.
echo Setting remote origin to %REPO_URL%...
git remote remove origin >nul 2>&1
git remote add origin %REPO_URL%

echo Ensuring branch is named main...
git branch -M main

echo Staging all changes...
git add .

git commit -m "feat(deploy): configure Vercel and GitHub Pages deployment with Swayam admin profile" >nul 2>&1

echo.
echo Pushing to GitHub (main branch)...
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo =======================================================
    echo [SUCCESS] Code successfully pushed to GitHub!
    echo.
    echo Next Steps:
    echo 1. Connect this repo to Vercel at https://vercel.com
    echo 2. Click "Deploy" (vercel.json is already pre-configured)
    echo =======================================================
) else (
    echo.
    echo [NOTICE] If authentication failed, please log in with:
    echo git push -u origin main
)

echo.
pause
