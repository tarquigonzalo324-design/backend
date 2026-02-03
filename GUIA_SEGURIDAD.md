# 🔒 GUÍA DE SEGURIDAD - BACKEND HOJA DE RUTA

## ✅ IMPLEMENTACIONES DE SEGURIDAD REALIZADAS

### 1. **Autenticación y Autorización JWT**
- ✅ Tokens JWT con expiración configurable (defecto: 1 hora)
- ✅ Refresh tokens para renovar sesiones (defecto: 7 días)
- ✅ Validación estricta de formato Bearer Token
- ✅ Secretos JWT fuerte (mínimo 32 caracteres recomendado)
- ✅ Algoritmo HS256 para firma de tokens
- ✅ Detección de tokens expirados y revocados
- ✅ Endpoint `/api/auth/logout` para cerrar sesión
- ✅ Endpoint `/api/auth/refresh` para renovar tokens

**Configuración:**
```env
JWT_SECRET=your_super_secret_jwt_key_here_at_least_32_chars_long
TOKEN_EXPIRY=1h
REFRESH_TOKEN_SECRET=your_super_secret_refresh_key_here_at_least_32_chars_long
REFRESH_TOKEN_EXPIRY=7d
```

---

### 2. **HTTPS/TLS en Producción**
- ✅ Soporte para HTTPS con certificados SSL/TLS
- ✅ Configuración automática en `NODE_ENV=production`
- ✅ Headers HSTS (HTTP Strict-Transport-Security)
- ✅ Máximo tiempo HSTS: 1 año con preload

**Configuración:**
```env
NODE_ENV=production
SSL_KEY=/etc/ssl/private/server.key
SSL_CERT=/etc/ssl/certs/server.crt
```

---

### 3. **Headers de Seguridad HTTP**
- ✅ **Helmet.js** para protección contra ataques comunes
  - Content-Security-Policy (CSP)
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - X-XSS-Protection: 1; mode=block
  - Strict-Transport-Security (HSTS)
  - Referrer-Policy
  - Permissions-Policy

- ✅ Remover headers que exponen información del servidor
  - Server header removido
  - X-Powered-By removido

---

### 4. **Rate Limiting (Protección contra Fuerza Bruta)**
- ✅ Rate limiting global: 100 requests / 15 minutos
- ✅ Rate limiting para login: 5 intentos / 15 minutos
- ✅ Algoritmo de key generator basado en IP
- ✅ Skip para health checks

**Configuración:**
```env
RATE_LIMIT_WINDOW_MS=900000      # 15 minutos
RATE_LIMIT_MAX_REQUESTS=100
LOGIN_RATE_LIMIT_MAX=5
```

---

### 5. **CORS (Cross-Origin Resource Sharing)**
- ✅ Whitelist de dominios permitidos
- ✅ Configuración granular de métodos HTTP
- ✅ Headers permitidos: Content-Type, Authorization
- ✅ Credentials habilitadas para sesiones autenticadas
- ✅ Preflight caching de 24 horas

**Configuración:**
```env
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,https://tudominio.com
```

---

### 6. **Validación de Inputs y Prevención de Inyecciones**
- ✅ **Express-Validator** para validación de datos
  - Validación de tipo y longitud
  - Sanitización de inputs
  - Validación de emails
  - Validación de números

- ✅ **Prevención de SQL Injection**
  - Parámetros preparados en queries PostgreSQL
  - Detección de patrones SQL maliciosos
  - Guard contra comandos SQL peligrosos

- ✅ **Prevención de Script Injection (XSS)**
  - Detección de tags HTML/script
  - Sanitización de inputs

- ✅ **Prevención de Command Injection**
  - Detección de caracteres peligrosos
  - Validación de sintaxis

**Validadores implementados:**
- Hojas de Ruta: `validateCreateHojaRuta`, `validateUpdateHojaRuta`
- Envíos: `validateCreateEnvio`
- Estados: `validateChangeEstado`, `validateChangeUbicacion`
- Búsquedas: `validateListQuery`

---

### 7. **Seguridad en Base de Datos**
- ✅ **Variables de entorno** para credenciales
- ✅ **Pool de conexiones** con límites configurables
- ✅ **SSL/TLS** para conexiones PostgreSQL en producción
- ✅ **Timeouts** de conexión (2 segundos)
- ✅ **Logging de eventos** de conexión

**Configuración:**
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sedegesOjaRuta
DB_USER=postgres
DB_PASSWORD=your_secure_password_here
DB_POOL_MAX=20
DB_IDLE_TIMEOUT=30000
DB_CONNECT_TIMEOUT=2000
DB_SSL_REJECT_UNAUTHORIZED=true
```

---

### 8. **Manejo de Errores Seguro**
- ✅ No expone detalles en producción
- ✅ Logging detallado en desarrollo
- ✅ Error handler global
- ✅ 404 handler personalizado
- ✅ Códigos de error descriptivos

---

### 9. **Logging y Auditoría**
- ✅ **Winston Logger** para logging empresarial
  - Logs a archivo y consola
  - Separación de logs de error y debug
  - Formato JSON en producción
  - Rotación automática de archivos
  - Máximo 10MB por archivo

**Archivos de log:**
- `logs/app.log` - Todos los eventos
- `logs/error.log` - Solo errores
- `logs/debug.log` - Debug (solo desarrollo)

**Log de seguridad incluye:**
- Intentos de login fallidos
- Intentos con token inválido
- Detección de SQL injection
- Rate limiting hits
- Acceso denegado por permisos
- IP del usuario
- User-Agent

---

### 10. **Middleware de Seguridad Personalizado**
- ✅ `sqlInjectionGuard` - Detecta ataques SQL
- ✅ `securityLogger` - Registra eventos de seguridad
- ✅ `addSecurityHeaders` - Headers adicionales
- ✅ `removeServerHeader` - Oculta información del servidor
- ✅ `payloadSizeLimit` - Previene ataques DoS

---

## 📋 CONFIGURACIÓN INICIAL PARA PRODUCCIÓN

### 1. **Generar Secretos Fuertes**

```bash
# Generar JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generar REFRESH_TOKEN_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. **Configurar Certificados SSL**

```bash
# Generar auto-signed certificate (desarrollo)
openssl req -x509 -newkey rsa:4096 -keyout server.key -out server.crt -days 365 -nodes

# O usar Let's Encrypt en producción
# https://letsencrypt.org/
```

### 3. **Variables de Entorno (.env)**

```env
# Servidor
NODE_ENV=production
PORT=3001

# Base de Datos
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sedegesOjaRuta
DB_USER=postgres
DB_PASSWORD=CONTRASEÑA_MUY_SEGURA_AQUI

# JWT
JWT_SECRET=GENERAR_CON_COMANDO_ARRIBA
TOKEN_EXPIRY=1h
REFRESH_TOKEN_SECRET=GENERAR_CON_COMANDO_ARRIBA
REFRESH_TOKEN_EXPIRY=7d

# SSL/TLS
SSL_KEY=/etc/ssl/private/server.key
SSL_CERT=/etc/ssl/certs/server.crt

# CORS
CORS_ORIGINS=https://tudominio.com,https://www.tudominio.com

# Logs
LOG_LEVEL=info
LOG_DIR=/var/log/hojaruta
```

### 4. **Permisos de Sistema (Linux)**

```bash
# Crear usuario específico para la aplicación
sudo useradd -r -s /bin/false hojaruta

# Asignar permisos de archivos
sudo chown -R hojaruta:hojaruta /app/hojaruta
sudo chmod -R 750 /app/hojaruta
sudo chmod 600 /app/hojaruta/.env

# Certificados SSL
sudo chmod 600 /etc/ssl/private/server.key
sudo chmod 644 /etc/ssl/certs/server.crt
```

---

## 🚀 COMANDOS ÚTILES

### Desarrollo
```bash
npm install          # Instalar dependencias
npm run dev         # Iniciar en modo desarrollo
npm run build       # Compilar TypeScript
npm run start       # Ejecutar en producción
```

### Seguridad
```bash
npm audit           # Auditar vulnerabilidades
npm audit fix       # Arreglar vulnerabilidades automáticamente
```

---

## 🔍 PUNTOS DE CONTROL DE SEGURIDAD

### Para Cada Endpoint:
1. ✅ **Autenticación**: ¿Requiere token JWT válido?
2. ✅ **Autorización**: ¿Se valida el rol del usuario?
3. ✅ **Validación**: ¿Se validan todos los inputs?
4. ✅ **Rate Limiting**: ¿Se aplica límite de requests?
5. ✅ **Logging**: ¿Se registran eventos de seguridad?
6. ✅ **SQL Injection**: ¿Se usan parámetros preparados?
7. ✅ **Error Handling**: ¿No expone detalles internos?

### Archivo [hojasRuta.ts](hojasRuta.ts):
```typescript
// Ejemplo de endpoint seguro:
router.post(
  '/',
  authenticateToken,          // Verificar JWT
  validateCreateHojaRuta,      // Validar inputs
  crearHojaRuta               // Controlador
);
```

---

## ⚠️ RECOMENDACIONES CRÍTICAS

### En Producción:

1. **NUNCA** confiar en `default-secret` para JWT_SECRET
2. **NUNCA** exponer archivos `.env` en repositorio (usar `.gitignore`)
3. **NUNCA** usar HTTP sin HTTPS
4. **SIEMPRE** usar certificados SSL válidos (Let's Encrypt)
5. **SIEMPRE** mantener variables de entorno en secreto
6. **SIEMPRE** usar contraseñas fuertes en BD
7. **SIEMPRE** auditar logs regularmente
8. **SIEMPRE** mantener dependencias actualizadas
9. **SIEMPRE** usar rate limiting
10. **SIEMPRE** validar todos los inputs

### Monitoreo:

```bash
# Revisar logs de errores
tail -f logs/error.log

# Revisar logs de seguridad
grep -i "error\|warn\|critical" logs/app.log

# Buscar intentos fallidos
grep -i "credenciales inválidas\|token expirado" logs/error.log
```

---

## 📚 REFERENCIAS

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/nodejs-security/)
- [JWT Security](https://tools.ietf.org/html/rfc7519)
- [HTTPS/TLS](https://www.ssl.com/article/ssl-tls-https-process/)

---

## ✨ RESUMEN

Tu backend ahora tiene implementadas **medidas de seguridad profesionales y complejas**:

- ✅ Autenticación JWT con tokens de corta duración
- ✅ HTTPS/TLS en producción
- ✅ Headers de seguridad HTTP con Helmet
- ✅ Rate limiting contra fuerza bruta
- ✅ CORS restrictivo
- ✅ Validación completa de inputs
- ✅ Prevención de SQL Injection
- ✅ Seguridad en base de datos
- ✅ Logging y auditoría
- ✅ Manejo de errores seguro

**El sistema está listo para producción.**

