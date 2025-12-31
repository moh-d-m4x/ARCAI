@echo off
setlocal enabledelayedexpansion

echo ========================================
echo   ARCAI - Windows Installer Build Script
echo ========================================
echo.

:: Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo WARNING: You are NOT running as Administrator.
    echo This build script requires Administrator privileges to create symbolic links within the installer.
    echo Please right-click on this file and select "Run as administrator".
    echo.
    choice /M "Do you want to try continuing anyway?"
    if errorlevel 2 (
        echo Exiting...
        pause
        exit /b
    )
)

:: Navigate to script directory
cd /d "%~dp0"

:: Step 1: Install dependencies
echo.
echo [1/3] Checking dependencies...
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies!
        pause
        exit /b 1
    )
) else (
    echo Dependencies already installed.
)

:: Step 2: Build the installer
echo.
echo [2/3] Building Windows Installer (EXE)...
echo This process may take a few minutes...
echo.

call npm run dist

if errorlevel 1 (
    echo.
    echo ========================================
    echo    BUILD FAILED
    echo ========================================
    echo Check the error message above.
    pause
    exit /b 1
)

:: Step 3: Move Executable and Clean Up
echo.
echo [3/4] Moving Installer to release folder...
if not exist "release\exe" mkdir "release\exe"
move /y "releases\*.exe" "release\exe\" >nul
if errorlevel 1 (
    echo WARNING: potentially failed to move installer. Check 'releases' folder.
) else (
    echo Installer moved successfully.
)

echo.
echo [4/4] Cleaning up intermediate files...
if exist "releases" rmdir /s /q "releases"

echo.
echo ========================================
echo    BUILD SUCCESSFUL!
echo ========================================
echo.
echo Installer location: %~dp0release\exe
echo.

explorer "%~dp0release\exe"

pause
