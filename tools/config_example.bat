@echo off
REM Machine-specific settings for the bats in tools\. Copy to config.bat (gitignored) and adjust.
REM Checkout of https://github.com/BenjaminKobjolke release-tool (run `uv sync` in it once).
set "RELEASE_TOOL_DIR=D:\GIT\BenjaminKobjolke\release-tool"
REM Checkout of GPT-json-translator (with its .venv set up).
set "GPT_JSON_TRANSLATOR_DIR=D:\GIT\BenjaminKobjolke\GPT-json-translator"
