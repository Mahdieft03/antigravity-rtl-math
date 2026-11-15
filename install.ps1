<#
.SYNOPSIS
    One-line installer & upgrader for Antigravity RTL + Math (no git required).
.EXAMPLE
    irm https://raw.githubusercontent.com/Mahdieft03/antigravity-rtl-math/main/install.ps1 | iex
#>
[CmdletBinding()]
param(
    [string]$InstallDir = $(if ($env:AG_RTL_INSTALL_DIR) { $env:AG_RTL_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA "antigravity-rtl-math" }),
    [string]$Preset = $env:AG_RTL_PRESET,
    [string]$Lang = $env:AG_RTL_LANG,
    [switch]$NoPatch,
    [switch]$NoGuard
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Owner = "Mahdieft03"
$Repo = "antigravity-rtl-math"

function Write-Info([string]$msg) { Write-Host "  [RTL+Math] $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg)   { Write-Host "  [OK]       $msg" -ForegroundColor Green }
function Write-Warn([string]$msg) { Write-Host "  [WARN]     $msg" -ForegroundColor Yellow }
function Write-Err([string]$msg)  { Write-Host "  [ERROR]    $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "  === Antigravity RTL + Math Installer (Windows) ===" -ForegroundColor Cyan
Write-Host "  Inspired by https://github.com/mmnaderi/antigravity-rtl" -ForegroundColor DarkGray
Write-Host ""

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Err "Node.js 20+ is required but was not found on PATH."
    Write-Info "Install Node.js LTS via:  winget install OpenJS.NodeJS.LTS"
    Write-Info "Or download from:         https://nodejs.org"
    return
}

$nodeMajor = [int](& node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -lt 20) {
    Write-Err "Node.js $nodeMajor detected, but version 20 or newer is required."
    return
}

$npmExe = (Get-Command npm.cmd -ErrorAction SilentlyContinue)
if (-not $npmExe) { $npmExe = (Get-Command npm -ErrorAction SilentlyContinue) }
if (-not $npmExe) {
    Write-Err "npm was not found alongside Node.js."
    return
}

$tmpRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("ag-rtl-math-" + [System.Guid]::NewGuid().ToString("N"))
$zipPath = Join-Path $tmpRoot "bundle.zip"
$extractDir = Join-Path $tmpRoot "src"

try {
    New-Item -ItemType Directory -Path $extractDir -Force | Out-Null

    $downloadUrl = "https://github.com/$Owner/$Repo/archive/refs/heads/main.zip"
    try {
        $headers = @{ "User-Agent" = "antigravity-rtl-math-installer"; "Accept" = "application/vnd.github+json" }
        $rel = Invoke-RestMethod -Uri "https://api.github.com/repos/$Owner/$Repo/releases/latest" -Headers $headers -TimeoutSec 8
        if ($rel -and $rel.zipball_url) {
            $downloadUrl = $rel.zipball_url
            Write-Info "Found release $($rel.tag_name) -> downloading..."
        }
    } catch {
        Write-Info "Downloading latest main branch archive from GitHub..."
    }

    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -Headers @{ "User-Agent" = "antigravity-rtl-math-installer" } -TimeoutSec 30
    Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

    $inner = Get-ChildItem -Path $extractDir -Directory | Select-Object -First 1
    if (-not $inner) {
        throw "Downloaded archive did not contain a valid project directory."
    }

    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }

    foreach ($sub in @("src", "assets", "demo", "docs", "test")) {
        $dstSub = Join-Path $InstallDir $sub
        if (Test-Path $dstSub) { Remove-Item -Path $dstSub -Recurse -Force -ErrorAction SilentlyContinue }
    }

    Copy-Item -Path (Join-Path $inner.FullName "*") -Destination $InstallDir -Recurse -Force
    Write-Ok "Installed source files to $InstallDir"

    Write-Info "Installing runtime dependencies..."
    Push-Location $InstallDir
    try {
        & $npmExe.Source install --omit=dev --no-audit --no-fund | Out-Null
    } finally {
        Pop-Location
    }
    Write-Ok "Dependencies installed."

    $binDir = Join-Path $InstallDir "bin"
    New-Item -ItemType Directory -Path $binDir -Force | Out-Null
    $cmdPath = Join-Path $binDir "antigravity-rtl-math.cmd"
    $cmdBody = "@echo off`r`nnode ""%~dp0..\src\cli.js"" %*`r`n"
    Set-Content -Path $cmdPath -Value $cmdBody -Encoding ASCII

    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $parts = @()
    if ($userPath) { $parts = $userPath -split ";" | Where-Object { $_ -and $_.Trim() -ne "" } }
    if ($parts -notcontains $binDir) {
        $newPath = (($parts + $binDir) -join ";")
        [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
        $env:Path = "$env:Path;$binDir"
        Write-Ok "Added 'antigravity-rtl-math' command to User PATH."
    }

    $cliPath = Join-Path $InstallDir "src\cli.js"

    if ($Preset -or $Lang) {
        $cfgArgs = @($cliPath)
        if ($Preset) { $cfgArgs += @("--preset", $Preset) }
        if ($Lang) { $cfgArgs += @("--lang", $Lang) }
        & node @cfgArgs
    }

    if (-not $NoPatch -and -not ($env:AG_RTL_NO_PATCH -eq "1")) {
        $running = Get-Process -Name "Antigravity" -ErrorAction SilentlyContinue
        $applyArgs = @($cliPath, "--ensure")
        if (-not $NoGuard -and -not ($env:AG_RTL_NO_GUARD -eq "1")) {
            $applyArgs += "--install-guard"
        }
        if ($running) {
            Write-Warn "Antigravity is currently running, so ASAR patching will complete after you restart it."
            & node @applyArgs
            Write-Host ""
            Write-Info "Next step: Close Antigravity completely, then run:"
            Write-Host "    antigravity-rtl-math --ensure" -ForegroundColor White
        } else {
            & node @applyArgs
            Write-Ok "Antigravity targets patched & verified!"
        }
    } elseif (-not $NoGuard -and -not ($env:AG_RTL_NO_GUARD -eq "1")) {
        & node $cliPath --install-guard
    }

    Write-Host ""
    Write-Ok "Done! Useful commands:"
    Write-Host "    antigravity-rtl-math --doctor   (run full diagnostics)" -ForegroundColor Gray
    Write-Host "    antigravity-rtl-math --update   (self-update from GitHub)" -ForegroundColor Gray
    Write-Host "    Press Alt+R inside Antigravity to open the settings glass panel." -ForegroundColor Gray
    Write-Host ""
} finally {
    if (Test-Path $tmpRoot) {
        Remove-Item -Path $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
