# Start Scrawlie: one double-click to get the latest version running.
#   1. pulls the latest code from GitHub
#   2. runs a new database update if there is one (copies it for you and opens the Supabase SQL editor)
#   3. redeploys the server functions if they changed since the last deploy
#   4. installs packages, starts live updates in a second window, and opens the website
$ErrorActionPreference = "Continue"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$ref = "uueawkqexfisdfsgibwf"

function Say($msg, $color = "Cyan") { Write-Host ""; Write-Host $msg -ForegroundColor $color }

Say "1/4  Getting the latest version..."
git pull --ff-only
if ($LASTEXITCODE -ne 0) {
  Say "Local copies of some files are in the way (usually just line endings). Resetting them to the GitHub version..." "Yellow"
  git checkout -- .
  git pull --ff-only
}
git log -1 --pretty="   Now on: %s"

# ---------- database ----------
Say "2/4  Checking the database..."
$envFile = Join-Path $root "app\.env"
$key = ""
if (Test-Path $envFile) {
  $line = Get-Content $envFile | Where-Object { $_ -match "^\s*EXPO_PUBLIC_SUPABASE_ANON_KEY\s*=" } | Select-Object -First 1
  if ($line) { $key = ($line -split "=", 2)[1].Trim().Trim('"') }
}
if (-not $key) {
  Say "app\.env is missing or has no key. Copy it from your old folder (app\.env) and run this again." "Red"
  Read-Host "Press Enter to close"; exit 1
}
# Each migration that adds a table: the table name that proves it has been run.
# Newer ones bump public.schema_version().
$checks = @(
  @{ file = "0003_calendar_feeds_and_recordings.sql"; table = "calendar_feeds" },
  @{ file = "0004_beta_no_trial.sql"; version = 4 }
)
$headers = @{ apikey = $key; Authorization = "Bearer $key" }
$dbVersion = 0
try {
  $v = Invoke-RestMethod -Method Post -Uri "https://$ref.supabase.co/rest/v1/rpc/schema_version" -Headers $headers -ContentType "application/json" -Body "{}" -TimeoutSec 20
  $dbVersion = [int]$v
} catch { }
foreach ($c in $checks) {
  $done = $false
  if ($c.version) { $done = $dbVersion -ge $c.version }
  else {
    try {
      $r = Invoke-WebRequest -UseBasicParsing -Uri "https://$ref.supabase.co/rest/v1/$($c.table)?select=id&limit=1" -Headers $headers -TimeoutSec 20
      $done = $r.StatusCode -eq 200
    } catch { $done = $false }
  }
  if ($done) { Write-Host "   $($c.file): already done" -ForegroundColor Green; continue }
  $sqlPath = Join-Path $root "supabase\migrations\$($c.file)"
  Get-Content $sqlPath -Raw | Set-Clipboard
  Start-Process "https://supabase.com/dashboard/project/$ref/sql/new"
  Say "A database update needs running once:" "Yellow"
  Write-Host "   The SQL is already copied. In the Supabase page that just opened:"
  Write-Host "   click in the editor, press Ctrl+V, then click Run."
  Write-Host "   You should see: Success. No rows returned"
  Read-Host "   Press Enter here when done"
}

# ---------- server functions ----------
Say "3/4  Checking the server functions..."
$marker = Join-Path $root "supabase\.temp\deployed-commit"
$fnCommit = git log -1 --format=%H -- supabase/functions
$last = if (Test-Path $marker) { (Get-Content $marker -Raw).Trim() } else { "" }
if ($fnCommit -ne $last) {
  $fns = Get-ChildItem (Join-Path $root "supabase\functions") -Directory | Where-Object { $_.Name -notlike "_*" } | ForEach-Object { $_.Name }
  $ok = $true
  foreach ($f in $fns) {
    Write-Host "   Deploying $f..."
    npx supabase functions deploy $f --use-api --project-ref $ref
    if ($LASTEXITCODE -ne 0) { $ok = $false; Say "   Deploying $f failed. If it says you're not logged in, run: npx supabase login   then start this again." "Red" }
  }
  if ($ok) { New-Item -ItemType Directory -Force (Split-Path $marker) | Out-Null; Set-Content $marker $fnCommit; Write-Host "   All functions deployed" -ForegroundColor Green }
} else {
  Write-Host "   Already up to date" -ForegroundColor Green
}

# ---------- website ----------
Say "4/4  Starting the website..."
Set-Location (Join-Path $root "app")
npm install --no-fund --no-audit --loglevel=error
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $root "scripts\live.ps1")
Say "The website opens in your browser in about a minute (http://localhost:8081)." "Green"
Write-Host "Keep this window open while you use it. To stop: press Ctrl+C here."
npx expo start --web
