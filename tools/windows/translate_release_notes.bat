@echo off
rem Fills in de/es/fr/zh_CN next to every release_notes\<version>\en.json.
rem Incremental and idempotent: only missing keys hit the API, so re-running is
rem safe. The locale codes must stay spelled exactly as in _locales\, because
rem the translator names each output file after the code it is given.
setlocal
pushd "%~dp0..\.."
for %%I in (.) do set "PROJECT_ROOT=%%~fI"
if not defined GPT_JSON_TRANSLATOR_DIR (
    echo GPT_JSON_TRANSLATOR_DIR must point to the GPT-json-translator checkout.
    set "ERR=1"
    goto failed
)
if not exist "%GPT_JSON_TRANSLATOR_DIR%\.venv\Scripts\python.exe" (
    echo Translator Python executable not found under "%GPT_JSON_TRANSLATOR_DIR%".
    set "ERR=1"
    goto failed
)
if not exist "%GPT_JSON_TRANSLATOR_DIR%\json_translator.py" (
    echo json_translator.py not found under "%GPT_JSON_TRANSLATOR_DIR%".
    set "ERR=1"
    goto failed
)
pushd "%GPT_JSON_TRANSLATOR_DIR%"
call .\.venv\Scripts\python.exe json_translator.py "%PROJECT_ROOT%\release_notes" --translate-recursive="en.json" --languages="de,es,fr,zh_CN"
set "ERR=%ERRORLEVEL%"
popd
goto done

:failed
echo.
echo Translation failed with code %ERR%.
if not defined TICKETS_WATCHER_COMMAND_RUN pause

:done
popd
exit /b %ERR%
