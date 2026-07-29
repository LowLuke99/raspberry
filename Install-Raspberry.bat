@echo off
:: Double-click me once. I create two shortcuts on your Desktop and quit.
::   - Raspberry         (opens the app)
::   - Update Raspberry  (git pull + rebuild + open)
setlocal
set "REPO=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO%scripts\Install-Shortcuts.ps1"
endlocal
