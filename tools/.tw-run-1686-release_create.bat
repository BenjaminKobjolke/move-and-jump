@echo off
setlocal
REM Machine-specific paths are kept out of git: config.bat is a local copy of config_example.bat.
if not exist "%~dp0config.bat" (
  echo ERROR: tools\config.bat not found. Copy tools\config_example.bat to tools\config.bat and adjust it.
  exit /b 1
)
call "%~dp0config.bat"
if not exist "%RELEASE_TOOL_DIR%\pyproject.toml" (
  echo ERROR: RELEASE_TOOL_DIR in tools\config.bat is not a release-tool checkout: "%RELEASE_TOOL_DIR%"
  exit /b 1
)
cd /d "%RELEASE_TOOL_DIR%"
call uv run python -m release_tool create "%~dp0release_create.ini" --project-root "%~dp0.." %*
set "RELEASE_EXIT_CODE=%ERRORLEVEL%"
cd /d "%~dp0"
endlocal & exit /b %RELEASE_EXIT_CODE%
