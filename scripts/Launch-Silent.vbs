' Raspberry - silent always-latest launcher.
'
' Purpose: launch Launch-Latest.ps1 with ZERO console flash. wscript.exe
' has no console, so the PowerShell process it spawns inherits "no
' console" as well. The user sees only the Raspberry window - either
' the app itself (already up to date) or the updater dialog (behind).

Set shell = CreateObject("WScript.Shell")
Set fso   = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
psPath    = fso.BuildPath(scriptDir, "Launch-Latest.ps1")

If Not fso.FileExists(psPath) Then
  MsgBox "Launch-Latest.ps1 not found at:" & vbCrLf & psPath, _
         vbCritical, "Raspberry"
  WScript.Quit 1
End If

cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & psPath & """"
shell.Run cmd, 0, False
