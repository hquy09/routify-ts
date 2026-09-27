param (
    [Parameter(Mandatory=$true)]
    [string]$ShortcutPath,

    [Parameter(Mandatory=$true)]
    [string]$TargetPath,

    [Parameter(Mandatory=$false)]
    [string]$WorkingDir = "",

    [Parameter(Mandatory=$false)]
    [string]$IconPath = "",

    [Parameter(Mandatory=$false)]
    [string]$Description = "Routify LifeOS"
)

try {
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath = $TargetPath

    if ($WorkingDir -and (Test-Path $WorkingDir)) {
        $Shortcut.WorkingDirectory = $WorkingDir
    } else {
        $Shortcut.WorkingDirectory = [System.IO.Path]::GetDirectoryName($TargetPath)
    }

    if ($IconPath -and (Test-Path $IconPath)) {
        $Shortcut.IconLocation = "$IconPath,0"
    }

    $Shortcut.Description = $Description
    $Shortcut.Save()
    Write-Host "[OK] Created shortcut at: $ShortcutPath"
} catch {
    Write-Error "Failed to create shortcut: $_"
    exit 1
}
