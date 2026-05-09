# 5분마다 KPX → Vercel ingest 호출.
# 사용법: pwsh scripts/run-ingest-loop.ps1
#         (또는 PowerShell 창에서 직접 실행)
# 종료: Ctrl+C

$ErrorActionPreference = 'Continue'

Write-Host "=== Dino Revival KPX Ingest Loop ===" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop." -ForegroundColor Cyan
Write-Host ""

while ($true) {
    $now = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Write-Host "[$now] Running ingest..." -ForegroundColor Yellow
    
    pnpm dotenv -e .env.local -- tsx scripts/kpx-ingest.ts
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[$now] OK" -ForegroundColor Green
    } else {
        Write-Host "[$now] FAILED (exit $LASTEXITCODE)" -ForegroundColor Red
    }
    
    Write-Host "Next run in 5 minutes..."
    Write-Host ""
    Start-Sleep -Seconds 300
}