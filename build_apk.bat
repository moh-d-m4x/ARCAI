@echo off
setlocal enabledelayedexpansion

echo ================================
echo   ARCAI - APK Build Script
echo ================================
echo.

:: Set output folder
set OUTPUT_DIR=release\apk

:: Step 1: Build the web app
echo [1/5] Building web app...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo ERROR: Web build failed!
    pause
    exit /b 1
)
echo Web build completed.
echo.

:: Step 2: Check if Android platform exists, add if not
echo [2/5] Checking Android platform...
if not exist "android" (
    echo Android platform not found, adding it now...
    call npx cap add android
    if %ERRORLEVEL% neq 0 (
        echo ERROR: Failed to add Android platform!
        pause
        exit /b 1
    )
    echo Android platform added.
) else (
    echo Android platform already exists.
)
echo.

:: Step 3: Sync with Capacitor
echo [3/5] Syncing with Capacitor...
call npx cap sync android
if %ERRORLEVEL% neq 0 (
    echo ERROR: Capacitor sync failed!
    pause
    exit /b 1
)
echo Capacitor sync completed.
echo.

:: Step 3.5: Check/Set Android SDK location
echo Checking Android SDK location...
if not exist "android\local.properties" (
    echo Creating local.properties with SDK path...
    
    :: Try common SDK locations
    if defined ANDROID_HOME (
        echo sdk.dir=!ANDROID_HOME:\=/!> android\local.properties
        echo Using ANDROID_HOME: !ANDROID_HOME!
    ) else if defined ANDROID_SDK_ROOT (
        echo sdk.dir=!ANDROID_SDK_ROOT:\=/!> android\local.properties
        echo Using ANDROID_SDK_ROOT: !ANDROID_SDK_ROOT!
    ) else if exist "%LOCALAPPDATA%\Android\Sdk" (
        echo sdk.dir=%LOCALAPPDATA:\=/%/Android/Sdk> android\local.properties
        echo Using default SDK path: %LOCALAPPDATA%\Android\Sdk
    ) else (
        echo.
        echo ERROR: Android SDK not found!
        echo Please set ANDROID_HOME environment variable to your Android SDK path.
        echo Typical location: %LOCALAPPDATA%\Android\Sdk
        pause
        exit /b 1
    )
)
echo.

:: Step 4: Build APK using Gradle
echo [4/5] Building APK...
cd android
call gradlew.bat assembleRelease
if %ERRORLEVEL% neq 0 (
    echo ERROR: APK build failed!
    cd ..
    pause
    exit /b 1
)
cd ..
echo APK build completed.
echo.

:: Step 5: Copy APK to release folder
echo [5/5] Copying APK to %OUTPUT_DIR%...
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

:: Find and copy the release APK
set APK_SOURCE=android\app\build\outputs\apk\release\app-release-unsigned.apk
if exist "%APK_SOURCE%" (
    copy "%APK_SOURCE%" "%OUTPUT_DIR%\ARCAI-release.apk"
    echo.
    echo ================================
    echo   BUILD SUCCESSFUL!
    echo   APK saved to: %OUTPUT_DIR%\ARCAI-release.apk
    echo ================================
) else (
    :: Try debug APK if release doesn't exist
    set APK_SOURCE=android\app\build\outputs\apk\debug\app-debug.apk
    if exist "!APK_SOURCE!" (
        copy "!APK_SOURCE!" "%OUTPUT_DIR%\ARCAI-debug.apk"
        echo.
        echo ================================
        echo   BUILD SUCCESSFUL!
        echo   APK saved to: %OUTPUT_DIR%\ARCAI-debug.apk
        echo ================================
    ) else (
        echo WARNING: Could not find APK file. Check android\app\build\outputs\apk\ folder.
    )
)

echo.
pause
