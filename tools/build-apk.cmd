@echo off
setlocal
pushd "%~dp0..\android" || exit /b 1
if not exist "..\web\index.html" (
    echo Missing web\index.html
    popd
    exit /b 1
)
call gradlew.bat --project-cache-dir "%LOCALAPPDATA%\com1cbt-build\project-cache" assembleDebug
if errorlevel 1 (
    popd
    exit /b 1
)
if not exist "..\dist" mkdir "..\dist"
copy /y "%LOCALAPPDATA%\com1cbt-build\app\outputs\apk\debug\app-debug.apk" "..\dist\com1cbt.apk"
set "BUILD_RESULT=%ERRORLEVEL%"
popd
exit /b %BUILD_RESULT%
