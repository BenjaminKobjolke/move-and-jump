@echo off
rem Sets an explicit version, e.g. to roll a bump back after a failed build:
rem version_set.bat 1.4.2
node "%~dp0..\version.mjs" set %1
