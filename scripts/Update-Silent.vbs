' Raspberry — silent updater wrapper.
'
' Purpose: launch Update-Raspberry.ps1 with ZERO console flash.
' wscript.exe has no console, so the PowerShell process it spawns
' inherits "no console" as well. The user sees no black window —
' only the WinForms progress dialog that Update-Raspberry.ps1 shows.

Set shell  = CreateObject("WScript.Shell")
Set fso    = CreateObject("Scripting.FileSystemObject")

' Script sits in <repo>\scripts\ ; find <repo>\scripts\Update-Raspberry.ps1
scriptDir  = fso.GetParentFolderName(WScript.ScriptFullName)
psPath     = fso.BuildPath(scriptDir, "Update-Raspberry.ps1")

If Not fso.FileExists(psPath) Then
  MsgBox "Update-Raspberry.ps1 not found at:" & vbCrLf & psPath, _
         vbCritical, "Raspberry Updater"
  WScript.Quit 1
End If

cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & psPath & """"

' Run: cmd, windowStyle 0 (hidden), waitOnReturn false (fire and forget)
shell.Run cmd, 0, False
