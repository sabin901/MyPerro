$ErrorActionPreference = 'Stop'

$binary = Resolve-Path 'src-tauri\target\release\pawi.exe'
$ready = Join-Path ([IO.Path]::GetTempPath()) 'pawi-startup-ready'
$log = Join-Path ([IO.Path]::GetTempPath()) 'pawi-windows-package-smoke.log'
Remove-Item -LiteralPath $ready -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $log -Force -ErrorAction SilentlyContinue
$previous = $env:PAWI_CI_SMOKE
$env:PAWI_CI_SMOKE = '1'
$process = $null

try {
  $process = Start-Process -FilePath $binary -PassThru -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError "$log.err"
  $deadline = [DateTime]::UtcNow.AddSeconds(25)
  while ([DateTime]::UtcNow -lt $deadline) {
    if (Test-Path -LiteralPath $ready) {
      Write-Output 'Packaged Pawi reached frontend ready state on Windows.'
      exit 0
    }
    if ($process.HasExited) {
      $details = (Get-Content -LiteralPath $log -Raw -ErrorAction SilentlyContinue) + (Get-Content -LiteralPath "$log.err" -Raw -ErrorAction SilentlyContinue)
      throw "Packaged Pawi exited before startup completed. $details"
    }
    Start-Sleep -Milliseconds 250
  }
  throw 'Packaged Pawi stayed alive but did not reach frontend ready state.'
} finally {
  if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force }
  if ($null -eq $previous) { Remove-Item Env:PAWI_CI_SMOKE -ErrorAction SilentlyContinue } else { $env:PAWI_CI_SMOKE = $previous }
  Remove-Item -LiteralPath $ready, $log, "$log.err" -Force -ErrorAction SilentlyContinue
}
