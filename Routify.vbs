' ====================================================================
'                ROUTIFY LIFEOS - 1-CLICK SILENT LAUNCHER
' ====================================================================
' Khoi chay toan bo he thong Backend & Frontend ngam hoan toan
' Khong xuat hien bat ky cua so den CMD nao, tu dong mo trinh duyet
' ====================================================================

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strPath = fso.GetParentFolderName(WScript.ScriptFullName)

pywExe = "pythonw.exe"
If fso.FileExists(strPath & "\backend\.venv\Scripts\pythonw.exe") Then
    pywExe = strPath & "\backend\.venv\Scripts\pythonw.exe"
ElseIf fso.FileExists(strPath & "\.venv\Scripts\pythonw.exe") Then
    pywExe = strPath & "\.venv\Scripts\pythonw.exe"
End If

WshShell.CurrentDirectory = strPath
WshShell.Run """" & pywExe & """ """ & strPath & "\run_silent.py""", 0, False
