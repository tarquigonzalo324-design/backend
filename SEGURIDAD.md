# 🔒 GUÍA COMPLETA DE SEGURIDAD - BACKEND HOJAS DE RUTA

## 📋 Tabla de Contenidos
1. [Implementaciones de Seguridad](#implementaciones)
2. [Variables de Entorno](#env-vars)
3. [Mejores Prácticas](#mejores-prácticas)
4. [Checklist de Deployment](#deployment)
5. [Monitoreo y Logs](#monitoreo)

---

## 🔐 Implementaciones de Seguridad {#implementaciones}

### 1. **Autenticación con JWT Mejorada**
- ✅ Expiración de tokens (1 hora por defecto)
- ✅ Refresh tokens (7 días)
- ✅ Secretos fuertes (mínimo 32 caracteres)
- ✅ Validación de estructura de tokens
- ✅ Algoritmo HS256 configurado

**Archivo:** `src/controllers/authController.ts`

```typescript
// Generar JWT_SECRET fuerte:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. **Headers de Seguridad HTTP (Helmet)**
- ✅ Content-Security-Policy
- ✅ X-Frame-Options: DENY
- ✅ X-XSS-Protection
- ✅ X-Content-Type-Options: nosniff
- ✅ HSTS (Strict-Transport-Security)
- ✅ Referrer-Policy

### 3. **Rate Limiting**
- ✅ Global: 100 requests por 15 minutos
- ✅ Login: 5 intentos por 15 minutos
- ✅ Basado en IP (con soporte para proxies)

### 4. **CORS Seguro**
- ✅ Whitelist de dominios específicos
- ✅ Métodos HTTP restrictivos
- ✅ Headers personalizados validados
- ✅ Credentials habilitado solo cuando es necesario

### 5. **Validación de Inputs**
- ✅ Express Validator en todas las rutas
- ✅ Sanitización de datos
- ✅ Detección de SQL Injection
- ✅ Detección de XSS patterns
- ✅ Validación de tipos y longitudes

### 6. **Base de Datos**
- ✅ Queries parametrizadas (evita SQL injection)
- ✅ SSL/TLS en producción
- ✅ Pool de conexiones configurado
- ✅ Validación de conexión al inicio

### 7. **Logging de Seguridad**
- ✅ Winston Logger con múltiples niveles
- ✅ Rotación de logs
- ✅ Archivos separados para errores
- ✅ No expone información sensible
- ✅ IP del cliente registrada

### 8. **Variables de Entorno**
- ✅ Validación al inicio
- ✅ Variables críticas requeridas
- ✅ Warnings para configuración débil
- ✅ .env.example con documentación

---

## 🔑 Variables de Entorno Críticas {#env-vars}

### Requeridas
```env
JWT_SECRET=your_super_secret_32+_chars_here
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hojas_ruta
DB_USER=postgres
DB_PASSWORD=secure_password_here
```

### Recomendadas
```env
NODE_ENV=production
PORT=3001
TOKEN_EXPIRY=1h
REFRESH_TOKEN_SECRET=another_secret_32+_chars
CORS_ORIGINS=https://yourdomain.com
```

### Producción
```env
NODE_ENV=production
SSL_KEY=/etc/ssl/private/server.key
SSL_CERT=/etc/ssl/certs/server.crt
DB_SSL_REJECT_UNAUTHORIZED=true
```

---

## ✅ Mejores Prácticas {#mejores-prácticas}

### 1. **Contraseñas**
- [ ] Usar bcryptjs con 12 rounds
- [ ] Nunca almacenar contraseñas en logs
- [ ] Validar fortaleza mínima (8+ caracteres)

### 2. **Tokens**
- [ ] JWT_SECRET nunca debe ser compartido
- [ ] Tokens almacenados en httpOnly cookies (cliente)
- [ ] Refresh tokens en base de datos (opcional)
- [ ] Blacklist de tokens revocados (implementar)

### 3. **Errores**
- [ ] No exponer stack traces en producción
- [ ] Mensajes de error genéricos al usuario
- [ ] Logs detallados solo internamente
- [ ] Nunca exponer rutas o estructura del código

### 4. **CORS**
- [ ] Configurar solo dominios confiables
- [ ] No usar `*` en producción
- [ ] Validar en cada petición

### 5. **Rate Limiting**
- [ ] Ajustar según carga esperada
- [ ] Diferentes límites por endpoint
- [ ] Log de intentos bloqueados

### 6. **Base de Datos**
- [ ] Usuario DB con permisos limitados
- [ ] Credenciales en variables de entorno
- [ ] SSL/TLS siempre en producción
- [ ] Respaldos regulares

### 7. **Datos Sensibles**
- [ ] No log de passwords, tokens, emails
- [ ] Sanitización en responses
- [ ] Encryption en tránsito (HTTPS)
- [ ] Encryption en reposo (opcional, para BBDD)

---

## 🚀 Checklist de Deployment {#deployment}

### Pre-Deployment
- [ ] Cambiar JWT_SECRET a valor fuerte único
- [ ] Cambiar DB_PASSWORD a password segura
- [ ] Configurar SSL_KEY y SSL_CERT
- [ ] Establecer NODE_ENV=production
- [ ] Validar CORS_ORIGINS
- [ ] Revisar logs para datos sensibles
- [ ] Ejecutar `npm audit` sin vulnerabilidades

### En Servidor
- [ ] Instalar certificados SSL válidos
- [ ] Usar HTTPS obligatorio
- [ ] Configurar firewall
- [ ] Habilitar HSTS
- [ ] Configurar reverse proxy (nginx/apache)
- [ ] Usar variables de entorno seguras
- [ ] No exponer puerto directamente
- [ ] Usar systemd o PM2 para reinicio automático

### Después de Deployment
- [ ] Monitorear logs de errores
- [ ] Verificar HTTPS funciona
- [ ] Probar JWT expiration
- [ ] Verificar rate limiting
- [ ] Revisar logs de seguridad
- [ ] Hacer pruebas de penetración básicas

---

## 📊 Monitoreo y Logs {#monitoreo}

### Ubicación de Logs
```
logs/
├── app.log      # Todos los eventos
├── error.log    # Solo errores
└── debug.log    # Debug (solo desarrollo)
```

### Eventos Importantes a Monitorear
```
❌ Failed login attempts
❌ Token verification errors
❌ Database connection errors
❌ Rate limit exceeded
⚠️ SQL injection attempts
⚠️ Suspicious input patterns
✅ Successful logins (sin datos sensibles)
✅ Tokens refreshed
```

### Comandos Útiles
```bash
# Ver últimos errores
tail -f logs/error.log

# Contar intentos de login fallidos
grep "Contraseña inválida" logs/app.log | wc -l

# Ver IPs sospechosas
grep "SQL injection" logs/app.log

# Monitorear en tiempo real
watch -n 1 'tail -20 logs/app.log'
```

---

## 🛡️ Endpoints Protegidos

### Autenticación
```
POST   /api/auth/login        - Necesita validación
POST   /api/auth/logout       - Requiere JWT
GET    /api/auth/verify       - Requiere JWT
POST   /api/auth/refresh      - Requiere refresh token
```

### Hojas de Ruta
```
GET    /api/hojas-ruta        - Requiere JWT + lectura
POST   /api/hojas-ruta        - Requiere JWT
PUT    /api/hojas-ruta/:id    - Requiere JWT + escritura
PATCH  /api/hojas-ruta/:id/*  - Requiere JWT + escritura
```

### Envíos
```
GET    /api/enviar            - Requiere JWT
POST   /api/enviar            - Requiere JWT
PUT    /api/enviar/:id/estado - Requiere JWT
```

---

## 🔍 Testing de Seguridad

### Con cURL
```bash
# Test JWT
curl -H "Authorization: Bearer TOKEN" http://localhost:3001/api/hojas-ruta

# Test CORS
curl -H "Origin: http://evil.com" http://localhost:3001/api/health -v

# Test Rate Limit
for i in {1..200}; do curl http://localhost:3001/api/health; done

# Test SQL Injection
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usuario":"admin'\''--","password":"x"}'
```

---

## 📚 Referencias

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Node.js Security](https://nodejs.org/en/docs/guides/security/)
- [Helmet.js Documentation](https://helmetjs.github.io/)

---

**Última actualización:** Diciembre 2025  
**Versión:** 1.0.0  
**Estado:** ✅ Implementado
