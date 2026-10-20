@echo off
setlocal
pushd "%~dp0..\.."
call npm run build -- --overwrite-dest
set ERR=%ERRORLEVEL%
popd
if %ERR% neq 0 (
    echo.
    echo Build failed with code %ERR%.
    if not defined TICKETS_WATCHER_COMMAND_RUN pause
)
exit /b %ERR%
