#!/bin/bash
# Script para generar secretos seguros para el backend

echo "🔐 GENERADOR DE SECRETOS SEGUROS - HOJAS DE RUTA"
echo "=================================================="
echo ""

# Generar JWT_SECRET
echo "🔑 JWT_SECRET (Token de Acceso):"
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "JWT_SECRET=$JWT_SECRET"
echo ""

# Generar REFRESH_TOKEN_SECRET
echo "🔄 REFRESH_TOKEN_SECRET (Token de Renovación):"
REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "REFRESH_TOKEN_SECRET=$REFRESH_SECRET"
echo ""

echo "=================================================="
echo "Copiar y pegar en tu archivo .env:"
echo "=================================================="
echo ""
echo "JWT_SECRET=$JWT_SECRET"
echo "REFRESH_TOKEN_SECRET=$REFRESH_SECRET"
echo ""
echo "=================================================="
echo "✅ Secretos generados exitosamente"
echo "⚠️  NUNCA compartas estos secretos públicamente"
echo "⚠️  NUNCA los commits a git o repositorio público"
