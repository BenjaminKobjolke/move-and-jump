@echo off
setlocal
node "%~dp0..\version.mjs" get
set "ERR=%ERRORLEVEL%"
endlocal & exit /b %ERR%
