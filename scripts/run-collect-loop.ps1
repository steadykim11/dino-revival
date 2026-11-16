# 5분마다 수집 작업(jobs/collect.ts)을 실행한다.
# 홈서버의 crontab이 준비되기 전까지 개인 PC에서 쓰는 임시 실행기.
#
# 사용법: 프로젝트 루트에서
#   .\scripts\run-collect-loop.ps1
# 종료: Ctrl+C

$ErrorActionPreference = 'Continue'

Write-Host "=== Dino Revival Collect Loop ===" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop." -ForegroundColor Cyan
Write-Host ""

while ($true) {
    $now = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Write-Host "[$now] Running collect..." -ForegroundColor Yellow

    pnpm job:collect

    if ($LASTEXITCODE -eq 0) {
        Write-Host "[$now] OK" -ForegroundColor Green
    } else {
        Write-Host "[$now] FAILED (exit $LASTEXITCODE)" -ForegroundColor Red
    }

    Write-Host "Next run in 5 minutes..."
    Write-Host ""
    Start-Sleep -Seconds 300
}
