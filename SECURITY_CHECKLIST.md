# ✅ CHECKLIST DE SEGURIDAD PRE-DEPLOYMENT

## 📋 Antes de Desplegar a Producción

### Secretos y Variables de Entorno
- [ ] JWT_SECRET cambiado a un valor fuerte (32+ caracteres)
- [ ] REFRESH_TOKEN_SECRET generado y configurado
- [ ] DB_PASSWORD es una contraseña fuerte
- [ ] DB_HOST apunta a instancia segura de PostgreSQL
- [ ] NODE_ENV=production en variables de entorno
- [ ] Archivo .env NO está en git (verificar .gitignore)
- [ ] Archivo .env NO está en repositorio público

### Base de Datos
- [ ] PostgreSQL actualizado a última versión estable
- [ ] Contraseña de usuario postgres cambiada
- [ ] Usuario específico para aplicación creado (no root)
- [ ] Base de datos sedegesOjaRuta existe
- [ ] Backups automatizados configurados
- [ ] SSL/TLS habilitado en PostgreSQL
- [ ] Conexiones remotas no autorizadas bloqueadas

### HTTPS/TLS
- [ ] Certificado SSL/TLS válido obtenido (Let's Encrypt, Comodo, etc)
- [ ] Clave privada protegida (permisos 600)
- [ ] Certificado público accesible (permisos 644)
- [ ] Cadena de certificados correcta
- [ ] Test con: https://www.ssllabs.com/ssltest/

### Headers de Seguridad
- [ ] HSTS habilitado (Strict-Transport-Security)
- [ ] CSP (Content-Security-Policy) configurado
- [ ] X-Frame-Options: DENY configurado
- [ ] X-Content-Type-Options: nosniff activo
- [ ] Referrer-Policy configurado
- [ ] Permissions-Policy configurado

### CORS
- [ ] CORS_ORIGINS configurado con dominio específico
- [ ] No usar '*' en producción
- [ ] Dominios permitidos validados
- [ ] Métodos HTTP restringidos (POST, GET, PUT, PATCH)
- [ ] Headers permitidos limitados

### Rate Limiting
- [ ] Rate limiting global habilitado
- [ ] Rate limiting para login más restrictivo (5 intentos)
- [ ] IP basado en X-Forwarded-For para proxies
- [ ] Endpoints críticos monitoreados

### Validación de Inputs
- [ ] Todos los endpoints validan inputs
- [ ] Prevención de SQL Injection activa
- [ ] Prevención de XSS implementada
- [ ] Tamaño máximo de payload configurado (10MB)
- [ ] Caracteres especiales sanitizados

### Logging y Monitoreo
- [ ] Logs configurados en archivo
- [ ] Logging de errores activo
- [ ] Logging de seguridad (intentos login fallidos, etc)
- [ ] Directorio de logs con permisos restrictivos (750)
- [ ] Rotación de logs configurada
- [ ] Sistema de alertas para errores críticos

### Autenticación
- [ ] Expiración de tokens configurada (1 hora)
- [ ] Refresh tokens habilitados (7 días)
- [ ] Password hashing con bcrypt + salt (12 rondas)
- [ ] Tokens revocación implementada (opcional)
- [ ] Logout endpoint funcional

### Autorización
- [ ] Middleware de autenticación en todas las rutas protegidas
- [ ] Roles y permisos validados
- [ ] requireWriteAccess en endpoints de escritura
- [ ] requireReadAccess en endpoints de lectura
- [ ] Usuarios sin permisos no pueden acceder

### Dependencias
- [ ] npm audit sin vulnerabilidades críticas
- [ ] npm audit fix ejecutado
- [ ] Dependencias actualizadas a versiones seguras
- [ ] package-lock.json presente y sincronizado
- [ ] No hay dependencias con vulnerabilidades conocidas

### Manejo de Errores
- [ ] Error messages no exponen detalles internos
- [ ] Stack traces no visibles en producción
- [ ] 500 errors loguean detalles pero devuelven genéricos
- [ ] 404 handlers personalizados

### Rendimiento y DoS
- [ ] Payload size limit configurado (10MB)
- [ ] Timeouts de conexión configurados
- [ ] Pool de conexiones BD optimizado
- [ ] Compresión gzip habilitada (si aplica)

### Testing
- [ ] Endpoints de autenticación testeados
- [ ] Validación de inputs testeada
- [ ] Rate limiting funcionando correctamente
- [ ] CORS funcionando en dominios permitidos
- [ ] CORS bloqueando dominios no permitidos

### Infraestructura
- [ ] Firewall configurado (solo puertos 80, 443 abiertos)
- [ ] SSH habilitado con keys (no contraseña)
- [ ] Sudo sin contraseña deshabilitado
- [ ] Root login deshabilitado
- [ ] Usuarios desconocidos removidos
- [ ] Servicio ejecuta con usuario no-root

### Monitoreo y Respuesta
- [ ] Sistema de logs centralizado (ELK, Datadog, etc)
- [ ] Alertas para errores críticos configuradas
- [ ] Plan de respuesta a incidentes definido
- [ ] Contacto de seguridad establecido
- [ ] Runbooks para incidentes de seguridad

### Documentación
- [ ] GUIA_SEGURIDAD.md actualizada
- [ ] README con instrucciones de setup
- [ ] API documentation disponible
- [ ] Proceso de deploy documentado

### Post-Deployment
- [ ] Health check `/api/health` respondiendo
- [ ] Logs monitoreados 24/7
- [ ] Alertas funcionando
- [ ] Backups verificados
- [ ] Plan de rollback listo

---

## 🔒 Verificación Rápida

```bash
# Compilar y verificar errores
npm run build

# Auditar dependencias
npm audit

# Verificar variables de entorno críticas
grep -E "JWT_SECRET|DB_PASSWORD" .env

# Verificar permisos de archivo
ls -la .env
ls -la /etc/ssl/private/server.key
```

---

## 📞 Soporte

- Reportar vulnerabilidades: security@hojaruta.com
- Documentación: GUIA_SEGURIDAD.md
- Código: src/

---

**Fecha de revisión**: Diciembre 2025
**Estado**: ✅ LISTO PARA PRODUCCIÓN
