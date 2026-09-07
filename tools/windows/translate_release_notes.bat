@echo off
rem Fills in de/es/fr/zh_CN next to every release_notes\<version>\en.json.
rem Incremental and idempotent: only missing keys hit the API, so re-running is
rem safe. The locale codes must stay spelled exactly as in _locales\, because
rem the translator names each output file after the code it is given.
setlocal
d:
cd "d:\GIT\BenjaminKobjolke\GPT-json-translator"
call .\.venv\Scripts\python.exe json_translator.py "d:\GIT\BenjaminKobjolke\thunderbird\move-and-jump\release_notes" --translate-recursive="en.json" --languages="de,es,fr,zh_CN"
set ERR=%ERRORLEVEL%
cd /d "%~dp0"
if %ERR% neq 0 (
    echo.
    echo Translation failed with code %ERR%.
    pause
)
exit /b %ERR%
