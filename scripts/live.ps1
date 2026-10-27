# Live updates: pulls Claude's latest changes every 10 seconds.
# Run it in a second terminal while `npx expo start` runs in the first one.
# The app refreshes on its own when files change.
Set-Location (Split-Path $PSScriptRoot -Parent)
Write-Host "Watching for updates... (press Ctrl+C to stop)" -ForegroundColor Cyan
while ($true) {
  $before = git rev-parse HEAD
  git pull --ff-only --quiet 2>$null
  if ($LASTEXITCODE -ne 0) { git checkout -- . 2>$null; git pull --ff-only --quiet 2>$null }  # line-ending leftovers blocking the update
  $after = git rev-parse HEAD
  if ($before -ne $after) {
    $msg = git log -1 --pretty=%s
    Write-Host ("[{0}] Updated: {1}" -f (Get-Date -Format "HH:mm:ss"), $msg) -ForegroundColor Green
    $changed = git diff --name-only $before $after
    if ($changed -match "app/package.json") {
      Write-Host "New packages added. Installing..." -ForegroundColor Yellow
      Push-Location app; npm install --no-fund --no-audit; Pop-Location
      Write-Host "Done. In the other terminal press Ctrl+C, then run: npx expo start   (then press w)" -ForegroundColor Yellow
    }
    if ($changed -match "supabase/") {
      Write-Host "Server code changed. Claude will tell you if you need to redeploy." -ForegroundColor Yellow
    }
  }
  Start-Sleep -Seconds 10
}
