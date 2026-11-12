# End-to-end check of the packaged program on a real Windows machine:
# install as a service, serve the panel and the screens, survive a crash,
# restart from the panel and uninstall cleanly. Run from an elevated prompt.
$ErrorActionPreference = 'Stop'
$dir = Join-Path $PSScriptRoot '..\..\release\DrDripVitrina' | Resolve-Path
$exe = Join-Path $dir 'DrDripVitrina.exe'
$base = 'http://127.0.0.1:3000'
$failed = $false

function Check($name, [scriptblock]$test) {
  try {
    if (& $test) { Write-Host "  ok    $name" } else { Write-Host "  FAIL  $name"; $script:failed = $true }
  } catch { Write-Host "  FAIL  $name -> $($_.Exception.Message)"; $script:failed = $true }
}
function Health { try { (Invoke-RestMethod "$base/api/health" -TimeoutSec 2).app -eq 'drdrip-vitrina' } catch { $false } }
function WaitHealth($seconds, $want = $true) {
  for ($i = 0; $i -lt $seconds * 2; $i++) { if ((Health) -eq $want) { return $true }; Start-Sleep -Milliseconds 500 }
  return $false
}
function ServiceState { $s = Get-Service DrDripVitrina -ErrorAction SilentlyContinue; if ($s) { "$($s.Status)" } else { 'missing' } }

Write-Host "Install"
& $exe --instalar --sin-navegador --sin-pausa
Check 'installer exit code is 0' { $LASTEXITCODE -eq 0 }
Check 'service is running' { (ServiceState) -eq 'Running' }
Check 'service starts automatically' { (Get-Service DrDripVitrina).StartType -eq 'Automatic' }
Check 'server answers' { WaitHealth 20 }
Check 'process has no window (session 0)' { (Get-Process DrDripVitrina | Select-Object -First 1).SessionId -eq 0 }
Check 'firewall rule exists for private networks' { (netsh advfirewall firewall show rule name="DrDrip Vitrina" | Out-String) -match '3000' }
Check 'panel is served' { (Invoke-WebRequest "$base/admin/" -UseBasicParsing).StatusCode -eq 200 }
Check 'screen 1 is served' { (Invoke-WebRequest "$base/1" -UseBasicParsing).Content -match 'Vitrina.boot' }
Check 'catalog was seeded' { (Invoke-RestMethod "$base/api/player/1").slides.Count -ge 5 }
Check 'data is inside the program folder' { Test-Path (Join-Path $dir 'data\drdrip.db') }
Check 'log file is written' { Test-Path (Join-Path $dir 'data\logs\vitrina.log') }

$token = (Invoke-RestMethod "$base/api/auth/login" -Method Post -ContentType 'application/json' -Body '{"pin":"1234"}').token
$auth = @{ Authorization = "Bearer $token" }
$status = Invoke-RestMethod "$base/api/system/status" -Headers $auth
Check 'runs in service mode' { $status.run_mode -eq 'servicio' -and $status.can_restart }
Check 'photo resizer (sharp) is available' { $status.image_resizer }

Write-Host "Single instance"
& $exe --sin-navegador --sin-pausa
Check 'second launch exits cleanly' { $LASTEXITCODE -eq 0 }
Check 'still exactly one server process' { @(Get-Process DrDripVitrina).Count -eq 1 }
& $exe --estado
Check '--estado reports running' { $LASTEXITCODE -eq 0 }

Write-Host "Recovery after a crash"
Stop-Process -Name DrDripVitrina -Force
Check 'server went down' { WaitHealth 10 $false }
Check 'service brought it back by itself' { WaitHealth 90 }

Write-Host "Restart from the panel"
$before = (Get-Process DrDripVitrina | Select-Object -First 1).Id
Check 'restart request is accepted' { Invoke-RestMethod "$base/api/system/restart" -Method Post -Headers $auth -ContentType 'application/json' -Body '{}' | Out-Null; $true }
Start-Sleep -Seconds 3
Check 'server is back after restart' { WaitHealth 60 }
Check 'it is a new process' { (Get-Process DrDripVitrina | Select-Object -First 1).Id -ne $before }
Check 'session survived the restart' { (Invoke-RestMethod "$base/api/system/status" -Headers $auth).version -ne $null }

Write-Host "Uninstall"
& $exe --desinstalar --sin-pausa
Check 'uninstaller exit code is 0' { $LASTEXITCODE -eq 0 }
Check 'service is gone' { (ServiceState) -eq 'missing' }
Check 'server stopped' { WaitHealth 15 $false }
Check 'firewall rule is gone' { (netsh advfirewall firewall show rule name="DrDrip Vitrina" | Out-String) -notmatch '3000' }
Check 'data folder was kept' { Test-Path (Join-Path $dir 'data\drdrip.db') }

Write-Host "`n--- vitrina.log ---"
Get-Content (Join-Path $dir 'data\logs\vitrina.log') -ErrorAction SilentlyContinue | Select-Object -Last 40
Remove-Item (Join-Path $dir 'data') -Recurse -Force -ErrorAction SilentlyContinue

if ($failed) { Write-Host "`nSMOKE TEST FAILED"; exit 1 }
Write-Host "`nSmoke test passed"
exit 0
