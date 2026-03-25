Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir

function Write-Log {
  param([string]$Message)
  Write-Host "[setup-windows] $Message"
}

function Test-Command {
  param([string]$Name)
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Refresh-Path {
  $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
  $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$machinePath;$userPath"
}

function Ensure-UserPathEntry {
  param(
    [string]$Entry,
    [string]$CleanupPattern = ""
  )

  if ([string]::IsNullOrWhiteSpace($Entry)) {
    return
  }

  $normalizedEntry = $Entry.Trim().TrimEnd("\")
  $currentUserPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
  $segments = @()

  foreach ($segment in (($currentUserPath -split ";") | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })) {
    $normalizedSegment = $segment.Trim().TrimEnd("\")
    if ($CleanupPattern -and $normalizedSegment -match $CleanupPattern) {
      continue
    }
    if ($normalizedSegment -ieq $normalizedEntry) {
      continue
    }
    $segments += $segment.Trim()
  }

  $segments += $normalizedEntry
  [System.Environment]::SetEnvironmentVariable("Path", ($segments -join ";"), "User")
  Refresh-Path
}

function Invoke-CheckedCommand {
  param(
    [string]$Command,
    [string[]]$Arguments = @()
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    $joinedArgs = if ($Arguments.Count -gt 0) { " $($Arguments -join ' ')" } else { "" }
    throw ("Command failed with exit code {0}: {1}{2}" -f $LASTEXITCODE, $Command, $joinedArgs)
  }
}

function Ensure-WingetPackage {
  param(
    [string]$Id,
    [string]$Label
  )

  if (-not (Test-Command "winget")) {
    throw "winget is required to run setup-windows.ps1."
  }

  $listed = winget list --exact --id $Id --accept-source-agreements 2>$null | Out-String
  if ($listed -match [Regex]::Escape($Id)) {
    Write-Log "$Label already installed."
    return
  }

  Write-Log "Installing $Label with winget."
  Invoke-CheckedCommand -Command "winget" -Arguments @(
    "install",
    "--exact",
    "--id",
    $Id,
    "--source",
    "winget",
    "--accept-package-agreements",
    "--accept-source-agreements"
  )
}

function Ensure-NodeVersion {
  if (-not (Test-Command "fnm")) {
    throw "fnm not found after installation. Open a new PowerShell and rerun this script."
  }

  $fnmEnv = (& fnm env --shell powershell) | Out-String
  Invoke-Expression $fnmEnv

  $nodeVersion = (Get-Content (Join-Path $RepoRoot ".nvmrc") -Raw).Trim()
  Write-Log "Installing and using Node $nodeVersion via fnm."
  Invoke-CheckedCommand -Command "fnm" -Arguments @("install", $nodeVersion)
  Invoke-CheckedCommand -Command "fnm" -Arguments @("use", $nodeVersion)

  $fnmNodeRoot = Join-Path $env:APPDATA "fnm\node-versions"
  $targetMajor = [int]($nodeVersion -replace "^v", "").Split(".")[0]
  $nodeInstallDir = Get-ChildItem $fnmNodeRoot -Directory -ErrorAction Stop |
  Where-Object { $_.Name -match "^v\d" } |
  ForEach-Object {
    $versionText = $_.Name.TrimStart("v")
    $version = $null
    if ([Version]::TryParse($versionText, [ref]$version)) {
      [PSCustomObject]@{
        Version    = $version
        InstallDir = Join-Path $_.FullName "installation"
      }
    }
  } |
  Where-Object {
    $_ -and
    $_.Version.Major -eq $targetMajor -and
    (Test-Path (Join-Path $_.InstallDir "node.exe"))
  } |
  Sort-Object Version -Descending |
  Select-Object -ExpandProperty InstallDir -First 1

  if (-not $nodeInstallDir) {
    throw "Could not resolve a stable fnm Node installation directory for major version $targetMajor."
  }

  $fnmMultiShellRoot = Join-Path $env:LOCALAPPDATA "fnm_multishells"
  $cleanupPatterns = @(
    [Regex]::Escape($fnmNodeRoot) + ".*\\installation\\?$",
    [Regex]::Escape($fnmMultiShellRoot) + ".*$"
  )
  $cleanupPattern = "(" + ($cleanupPatterns -join ")|(") + ")"
  Ensure-UserPathEntry -Entry $nodeInstallDir -CleanupPattern $cleanupPattern
  Write-Log "Ensured Node is available in new shells via user PATH: $nodeInstallDir"
}

function Ensure-EnvFile {
  $envPath = Join-Path $RepoRoot ".env"
  $examplePath = Join-Path $RepoRoot ".env.example"
  if ((Test-Path $envPath) -or (-not (Test-Path $examplePath))) {
    return
  }

  Write-Log "Creating local .env from .env.example."
  Copy-Item $examplePath $envPath
}

function Resolve-PythonCommand {
  if (Test-Command "py") {
    return @("py", "-m")
  }
  if (Test-Command "python") {
    return @("python", "-m")
  }
  throw "Python launcher not found after installation."
}

Set-Location $RepoRoot

Ensure-WingetPackage -Id "Git.Git" -Label "Git"
Ensure-WingetPackage -Id "Python.Python.3.11" -Label "Python 3.11"
Ensure-WingetPackage -Id "Schniz.fnm" -Label "fnm"
Refresh-Path
Ensure-NodeVersion
Ensure-EnvFile

Write-Log "Installing npm dependencies."
Invoke-CheckedCommand -Command "npm" -Arguments @("ci")

$pythonCommand = Resolve-PythonCommand
Write-Log "Installing Python dependencies."
Invoke-CheckedCommand -Command $pythonCommand[0] -Arguments @($pythonCommand[1], "pip", "install", "--upgrade", "pip")
Invoke-CheckedCommand -Command $pythonCommand[0] -Arguments @($pythonCommand[1], "pip", "install", "-r", "requirements.txt")

Write-Log "Installing Playwright Chromium browser."
Invoke-CheckedCommand -Command "npx" -Arguments @("playwright", "install", "chromium")

Write-Log "Running installation verification."
Invoke-CheckedCommand -Command "node" -Arguments @("scripts/verify-install.mjs")

Write-Log "Setup complete."
