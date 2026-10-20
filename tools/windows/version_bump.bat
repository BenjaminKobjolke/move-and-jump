@echo off
setlocal
rem Bumps manifest.json (and package.json) to the next version. Level defaults
rem to patch: version_bump.bat, version_bump.bat minor, version_bump.bat major.
node "%~dp0..\version.mjs" bump %1
set "ERR=%ERRORLEVEL%"
endlocal & exit /b %ERR%
