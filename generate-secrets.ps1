# Script para generar secretos seguros (PowerShell - Windows)

Write-Host "🔐 GENERADOR DE SECRETOS SEGUROS - HOJAS DE RUTA" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Generar JWT_SECRET
Write-Host "🔑 JWT_SECRET (Token de Acceso):" -ForegroundColor Yellow
$JWT_SECRET = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
Write-Host "JWT_SECRET=$JWT_SECRET" -ForegroundColor Green
Write-Host ""

# Generar REFRESH_TOKEN_SECRET
Write-Host "🔄 REFRESH_TOKEN_SECRET (Token de Renovación):" -ForegroundColor Yellow
$REFRESH_SECRET = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
Write-Host "REFRESH_TOKEN_SECRET=$REFRESH_SECRET" -ForegroundColor Green
Write-Host ""

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Copiar y pegar en tu archivo .env:" -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "JWT_SECRET=$JWT_SECRET" -ForegroundColor White
Write-Host "REFRESH_TOKEN_SECRET=$REFRESH_SECRET" -ForegroundColor White
Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "✅ Secretos generados exitosamente" -ForegroundColor Green
Write-Host "⚠️  NUNCA compartas estos secretos públicamente" -ForegroundColor Red
Write-Host "⚠️  NUNCA los commits a git o repositorio público" -ForegroundColor Red
