@echo off
setlocal
rem Rolls a patch bump back (1.5.1 -> 1.5.0). release-tool create calls this
rem with no arguments when its build step fails.
node "%~dp0..\version.mjs" unbump
set "ERR=%ERRORLEVEL%"
endlocal & exit /b %ERR%
