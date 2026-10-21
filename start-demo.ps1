$ErrorActionPreference = 'Stop'

Write-Host "Starting Postgres and Redis..."
docker start lavivenzia-crm-dev-db-1 lavivenzia-crm-dev-redis-1

Write-Host "Starting Backend..."
Start-Process -FilePath "node" -ArgumentList "dist/main.js" -WorkingDirectory "packages/twenty-server" -WindowStyle Hidden

Write-Host "Starting Queue Worker..."
Start-Process -FilePath "node" -ArgumentList "dist/queue-worker/queue-worker.js" -WorkingDirectory "packages/twenty-server" -WindowStyle Hidden

Write-Host "Creating Backend Tunnel..."
$backendTunnel = Start-Process -FilePath "npx" -ArgumentList "lt --port 3000 --subdomain lavi-api-demo" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 3
$backendUrl = "https://lavi-api-demo.loca.lt"
Write-Host "Backend URL: $backendUrl"

Write-Host "Configuring Frontend..."
Set-Content -Path "packages/lv-app/.env.local" -Value "VITE_LV_SERVER_URL=$backendUrl"

Write-Host "Starting Frontend..."
Start-Process -FilePath "npm" -ArgumentList "run dev" -WorkingDirectory "packages/lv-app" -WindowStyle Hidden

Write-Host "Creating Frontend Tunnel..."
$frontendTunnel = Start-Process -FilePath "npx" -ArgumentList "lt --port 3200 --subdomain lavi-demo" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 3
$frontendUrl = "https://lavi-demo.loca.lt"
Write-Host "Frontend URL: $frontendUrl"

Write-Host "========================================="
Write-Host "DEMO IS READY!"
Write-Host "Tell your founder to visit:"
Write-Host "$frontendUrl"
Write-Host "Important: First visit to a Localtunnel URL will show a 'friendly warning' screen. They just need to click 'Continue'."
Write-Host "========================================="
