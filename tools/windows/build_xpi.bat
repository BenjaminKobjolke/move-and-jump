@echo off
setlocal
pushd "%~dp0..\.."
call npm run build -- --overwrite-dest
set ERR=%ERRORLEVEL%
popd
if %ERR% neq 0 (
    echo.
    echo Build failed with code %ERR%.
    pause
)
exit /b %ERR%
