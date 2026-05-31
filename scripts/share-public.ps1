param(
    [string]$TunnelProvider = "cloudflare"
)

$ErrorActionPreference = "Stop"

# With -File execution, $PSScriptRoot is the directory containing the script
$repoRoot = $PSScriptRoot
if (-not $repoRoot) {
    $repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
}
if (-not (Test-Path "$repoRoot\package.json")) {
    # Fallback for environments where PSScriptRoot isn't set
    $repoRoot = $PSScriptRoot
    if (-not $repoRoot) { $repoRoot = "D:\PROJELER\electroBun_arabic_game" }
}

$outputDir = Join-Path $repoRoot "output"
$serverLog = Join-Path $outputDir "share-server.log"
$serverErrLog = Join-Path $outputDir "share-server.err.log"
$previewLog = Join-Path $outputDir "share-preview.log"
$previewErrLog = Join-Path $outputDir "share-preview.err.log"
$cloudflaredLog = Join-Path $outputDir "share-cloudflared.log"
$cloudflaredErrLog = Join-Path $outputDir "share-cloudflared.err.log"
$ngrokLog = Join-Path $outputDir "share-ngrok.log"
$ngrokErrLog = Join-Path $outputDir "share-ngrok.err.log"
$sessionJson = Join-Path $outputDir "public-session.json"

$requestedTunnelProvider = if ($env:SHARE_TUNNEL_PROVIDER) { $env:SHARE_TUNNEL_PROVIDER.Trim().ToLowerInvariant() } else { "cloudflare" }
$cloudflareProtocol = if ($env:SHARE_CLOUDFLARE_PROTOCOL) { $env:SHARE_CLOUDFLARE_PROTOCOL } else { "http2" }
$allowNgrokFallback = $false
if ($env:SHARE_ALLOW_NGROK_FALLBACK) {
  $allowNgrokFallback = $env:SHARE_ALLOW_NGROK_FALLBACK -match '^(1|true|yes|on)$'
}

# Use parameter if provided, otherwise fallback to environment variable
$requestedTunnelProvider = if ($TunnelProvider -and $TunnelProvider -ne "cloudflare") { $TunnelProvider } else { "cloudflare" }
if ($env:SHARE_TUNNEL_PROVIDER) {
  $requestedTunnelProvider = $env:SHARE_TUNNEL_PROVIDER.Trim().ToLowerInvariant()
}

if ($requestedTunnelProvider -notin @("cloudflare", "ngrok", "auto")) {
  throw "Gecersiz SHARE_TUNNEL_PROVIDER degeri: '$requestedTunnelProvider'. Gecerli degerler: cloudflare, ngrok, auto."
}

if ($requestedTunnelProvider -eq "auto") {
  $allowNgrokFallback = $true
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

function Wait-Until {
  param(
    [scriptblock]$Condition,
    [int]$TimeoutSeconds = 30,
    [string]$FailureMessage = "Timeout"
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (& $Condition) {
      return
    }
    Start-Sleep -Milliseconds 500
  }

  throw $FailureMessage
}

function Stop-WorkspaceProcesses {
  $patterns = @(
    "npm run server",
    "server[\\/]multiplayer-server\\.mjs",
    "npm run preview",
    "vite preview --host 127\\.0\\.0\\.1 --port 4173"
  )

  foreach ($pattern in $patterns) {
    Get-CimInstance Win32_Process |
      Where-Object {
        $_.CommandLine -match $pattern -and (
          $_.CommandLine -match [regex]::Escape($repoRoot) -or
          $_.CommandLine -match "server[\\/]multiplayer-server\.mjs" -or
          $_.CommandLine -match "vite preview --host 127\.0\.0\.1 --port 4173"
        )
      } |
      ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
      }
  }

  foreach ($port in @(2567, 4173)) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique |
      Where-Object { $_ } |
      ForEach-Object {
        Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
      }
  }

  Start-Sleep -Milliseconds 700

  Get-Process -Name ngrok -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Get-Process -Name cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}

function Start-LoggedPowerShell {
  param(
    [string]$Command,
    [string]$LogPath,
    [string]$ErrorLogPath
  )

  return Start-Process -FilePath powershell -ArgumentList @(
    "-NoLogo",
    "-NoProfile",
    "-Command",
    $Command
  ) -WorkingDirectory $repoRoot -RedirectStandardOutput $LogPath -RedirectStandardError $ErrorLogPath -PassThru
}

function Get-LogTail {
  param(
    [string]$Path,
    [int]$LineCount = 12
  )

  if (-not (Test-Path $Path)) {
    return "(log yok)"
  }

  $lines = Get-Content -Path $Path -Tail $LineCount -ErrorAction SilentlyContinue
  if (-not $lines) {
    return "(log bos)"
  }

  return ($lines -join [Environment]::NewLine)
}

Stop-WorkspaceProcesses

$serverProcess = Start-LoggedPowerShell -LogPath $serverLog -ErrorLogPath $serverErrLog -Command "npm run server"

# Note: The parent PowerShell process exits after spawning the server, so we only check port health
Wait-Until -TimeoutSeconds 30 -FailureMessage "Multiplayer server ayaga kalkmadi." -Condition {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:2567/health" -TimeoutSec 5
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

$previewProcess = Start-LoggedPowerShell -LogPath $previewLog -ErrorLogPath $previewErrLog -Command "npm run preview"

# Note: The parent PowerShell process exits after spawning vite, so we only check port health
Wait-Until -TimeoutSeconds 180 -FailureMessage "Vite preview ayaga kalkmadi." -Condition {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:4173/" -TimeoutSec 5
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

$cloudflaredCommand = Get-Command cloudflared -ErrorAction SilentlyContinue
$cloudflaredPath = if ($cloudflaredCommand) { $cloudflaredCommand.Source } else { $null }
$ngrokCommand = Get-Command ngrok -ErrorAction SilentlyContinue
$ngrokPath = if ($ngrokCommand) { $ngrokCommand.Source } else { $null }

$publicUrl = $null
$tunnelProvider = $null
$tunnelProcess = $null

if ($requestedTunnelProvider -ne "ngrok" -and $cloudflaredPath) {
  $cloudflaredArgs = @(
    "tunnel",
    "--url",
    "http://127.0.0.1:4173",
    "--protocol",
    $cloudflareProtocol,
    "--no-autoupdate"
  )

  $tunnelProcess = Start-Process -FilePath $cloudflaredPath -ArgumentList $cloudflaredArgs -WorkingDirectory $repoRoot -RedirectStandardOutput $cloudflaredLog -RedirectStandardError $cloudflaredErrLog -PassThru

  Wait-Until -TimeoutSeconds 40 -FailureMessage "Cloudflare public URL olusmadi." -Condition {
    try {
      if ($tunnelProcess.HasExited) {
        throw "cloudflared erken kapandi. Log: $cloudflaredErrLog"
      }
      if (-not (Test-Path $cloudflaredErrLog)) {
        return $false
      }
      $content = Get-Content -Path $cloudflaredErrLog -Raw
      return $content -match 'https://[a-z0-9-]+\.trycloudflare\.com'
    } catch {
      throw
    }
  }

  $cloudflaredContent = Get-Content -Path $cloudflaredErrLog -Raw
  if ($cloudflaredContent -match '(https://[a-z0-9-]+\.trycloudflare\.com)') {
    $publicUrl = $Matches[1]
    $tunnelProvider = "cloudflare"
  }
} elseif ($requestedTunnelProvider -eq "cloudflare") {
  throw "cloudflared bulunamadi. Cloudflare ile paylasim icin PATH uzerinden cloudflared gerekli."
}

if (-not $publicUrl -and ($allowNgrokFallback -or $requestedTunnelProvider -eq "ngrok")) {
  if (-not $ngrokPath) {
    throw "ngrok bulunamadi. ngrok ile paylasim icin PATH uzerinden ngrok gerekli."
  }

  $ngrokArgs = @(
    "http",
    "http://127.0.0.1:4173",
    "--log",
    "stdout",
    "--log-format",
    "json"
  )

  $tunnelProcess = Start-Process -FilePath $ngrokPath -ArgumentList $ngrokArgs -WorkingDirectory $repoRoot -RedirectStandardOutput $ngrokLog -RedirectStandardError $ngrokErrLog -PassThru

  Wait-Until -TimeoutSeconds 30 -FailureMessage "ngrok public URL olusmadi." -Condition {
    try {
      if ($tunnelProcess.HasExited) {
        throw "ngrok erken kapandi. Log: $ngrokLog"
      }
      if (-not (Test-Path $ngrokLog)) {
        return $false
      }
      $content = Get-Content -Path $ngrokLog -Raw
      return $content -match '"msg":"started tunnel"' -and $content -match '"url":"https://[^"]+"'
    } catch {
      throw
    }
  }

  $ngrokLines = Get-Content -Path $ngrokLog
  foreach ($line in $ngrokLines) {
    if ($line -match '"msg":"started tunnel"' -and $line -match '"url":"(https://[^"]+)"') {
      $publicUrl = $Matches[1]
      $tunnelProvider = "ngrok"
    }
  }
}

if (-not $publicUrl) {
  throw "Public URL bulunamadi. Loglari kontrol edin: $cloudflaredErrLog / $ngrokLog"
}

$session = [ordered]@{
  serverPid = $serverProcess.Id
  previewPid = $previewProcess.Id
  tunnelPid = $tunnelProcess.Id
  tunnelProvider = $tunnelProvider
  publicUrl = $publicUrl
  localUrl = "http://127.0.0.1:4173/"
  serverUrl = "http://127.0.0.1:2567/"
  createdAt = (Get-Date).ToString("o")
}
$session | ConvertTo-Json | Set-Content -Path $sessionJson -Encoding UTF8

Write-Host ""
Write-Host "Paylasim hazir." -ForegroundColor Green
Write-Host "Provider : $tunnelProvider"
Write-Host "Public URL: $publicUrl"
Write-Host "Local URL : http://127.0.0.1:4173/"
Write-Host "Server   : http://127.0.0.1:2567/"
Write-Host "Admin    : $publicUrl/host.html"
Write-Host "Session   : $sessionJson"
Write-Host ""
Write-Host "Loglar:"
Write-Host "- Server     : $serverLog"
Write-Host "- Preview    : $previewLog"
if ($tunnelProvider -eq "cloudflare") {
  Write-Host "- Cloudflared: $cloudflaredErrLog"
} else {
  Write-Host "- Ngrok      : $ngrokLog"
}
