@echo off
rem Release build for release-tool create: the CI checks, then the .xpi.
rem Unlike build_xpi.bat it never pauses, so a failure returns straight to the
rem caller with its exit code. No `npm run lint`: web-ext lint is the Firefox
rem linter and always errors on Thunderbird's experiment_apis.
setlocal
pushd "%~dp0..\.."
call npm test
set ERR=%ERRORLEVEL%
if %ERR% neq 0 goto done
call npm run build -- --overwrite-dest
set ERR=%ERRORLEVEL%
:done
popd
endlocal & exit /b %ERR%
