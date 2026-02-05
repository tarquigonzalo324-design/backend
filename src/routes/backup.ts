import { Router, Request, Response } from 'express';
import pool from '../config/database';
import logger from '../utils/logger';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Middleware para verificar rol admin/desarrollador
const requireAdmin = (req: Request, res: Response, next: Function) => {
  const userRole = (req as any).userRole;
  const rolesPermitidos = ['administrador', 'desarrollador'];
  
  if (!userRole || !rolesPermitidos.includes(userRole.toLowerCase())) {
    logger.warn({ message: 'Acceso denegado a backup', userRole });
    return res.status(403).json({ error: 'Acceso denegado. Solo administradores pueden realizar esta acción.' });
  }
  next();
};

// Tablas a exportar en orden (respetando dependencias de FK)
const TABLAS_BACKUP = [
  'roles',
  'permisos_rol',
  'unidades',
  'usuarios',
  'tipos_tramite',
  'hojas_ruta',
  'ubicacion_recepcion',
  'historial_hojas_ruta',
  'envios',
  'notificaciones',
  'historial_actividades',
  'seguimiento',
  'progreso_hojas_ruta'
];

// Función para escapar valores SQL
const escapeSqlValue = (value: any): string => {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  if (value instanceof Date) {
    return `'${value.toISOString()}'`;
  }
  if (typeof value === 'object') {
    // JSONB
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }
  // String - escapar comillas simples
  return `'${String(value).replace(/'/g, "''")}'`;
};

// GET /api/backup/crear - Generar y descargar backup
router.get('/crear', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    logger.info({ message: 'Iniciando backup de base de datos', userId });

    let sqlContent = '';
    const fecha = new Date().toISOString().split('T')[0];
    const hora = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');

    // Encabezado del backup
    sqlContent += `-- =====================================================\n`;
    sqlContent += `-- BACKUP SISTEMA HOJAS DE RUTA\n`;
    sqlContent += `-- Fecha: ${fecha} ${hora}\n`;
    sqlContent += `-- Usuario ID: ${userId || 'Sistema'}\n`;
    sqlContent += `-- =====================================================\n\n`;
    sqlContent += `-- IMPORTANTE: Este backup solo contiene los DATOS (INSERT)\n`;
    sqlContent += `-- La estructura de tablas debe existir previamente\n\n`;
    sqlContent += `SET client_encoding = 'UTF8';\n\n`;

    // Exportar cada tabla
    for (const tabla of TABLAS_BACKUP) {
      try {
        const result = await pool.query(`SELECT * FROM ${tabla} ORDER BY id`);
        
        if (result.rows.length > 0) {
          sqlContent += `-- =====================================================\n`;
          sqlContent += `-- Tabla: ${tabla} (${result.rows.length} registros)\n`;
          sqlContent += `-- =====================================================\n`;
          
          // Obtener nombres de columnas
          const columnas = Object.keys(result.rows[0]);
          
          for (const row of result.rows) {
            const valores = columnas.map(col => escapeSqlValue(row[col]));
            sqlContent += `INSERT INTO ${tabla} (${columnas.join(', ')}) VALUES (${valores.join(', ')}) ON CONFLICT DO NOTHING;\n`;
          }
          
          sqlContent += '\n';
        }
      } catch (tableError: any) {
        // Si la tabla no existe, continuar
        logger.warn({ message: `Tabla ${tabla} no encontrada o error`, error: tableError.message });
        sqlContent += `-- Tabla ${tabla}: No encontrada o error\n\n`;
      }
    }

    // Actualizar secuencias
    sqlContent += `-- =====================================================\n`;
    sqlContent += `-- Actualizar secuencias (IDs)\n`;
    sqlContent += `-- =====================================================\n`;
    for (const tabla of TABLAS_BACKUP) {
      sqlContent += `SELECT setval('${tabla}_id_seq', COALESCE((SELECT MAX(id) FROM ${tabla}), 1), true);\n`;
    }

    // Configurar respuesta como archivo descargable
    const filename = `backup_hojas_ruta_${fecha}_${hora}.sql`;
    
    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', Buffer.byteLength(sqlContent, 'utf8'));
    
    logger.info({ message: 'Backup generado exitosamente', filename, size: sqlContent.length });
    
    res.send(sqlContent);

  } catch (error: any) {
    logger.error({ message: 'Error al crear backup', error: error.message });
    res.status(500).json({ error: 'Error al generar backup', details: error.message });
  }
});

// POST /api/backup/restaurar - Restaurar desde archivo SQL
router.post('/restaurar', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { sql_content, confirmar } = req.body;

    if (!confirmar) {
      return res.status(400).json({ 
        error: 'Debe confirmar la restauración',
        warning: 'Esta acción puede sobrescribir datos existentes'
      });
    }

    if (!sql_content || typeof sql_content !== 'string') {
      return res.status(400).json({ error: 'Contenido SQL no proporcionado' });
    }

    logger.info({ message: 'Iniciando restauración de backup', userId });

    // Separar comandos SQL (por punto y coma seguido de salto de línea)
    const comandos = sql_content
      .split(/;\s*\n/)
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    let ejecutados = 0;
    let errores = 0;
    const erroresDetalle: string[] = [];

    // Ejecutar cada comando
    for (const comando of comandos) {
      if (comando.length < 5) continue; // Ignorar comandos muy cortos
      
      try {
        await pool.query(comando);
        ejecutados++;
      } catch (cmdError: any) {
        errores++;
        if (erroresDetalle.length < 10) {
          erroresDetalle.push(`${cmdError.message.substring(0, 100)}`);
        }
      }
    }

    logger.info({ 
      message: 'Restauración completada', 
      userId,
      comandos_ejecutados: ejecutados,
      errores 
    });

    res.json({
      success: true,
      message: 'Restauración completada',
      comandos_ejecutados: ejecutados,
      errores,
      errores_detalle: erroresDetalle
    });

  } catch (error: any) {
    logger.error({ message: 'Error al restaurar backup', error: error.message });
    res.status(500).json({ error: 'Error al restaurar backup', details: error.message });
  }
});

// GET /api/backup/info - Información de la base de datos
router.get('/info', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const info: any = { tablas: [] };

    for (const tabla of TABLAS_BACKUP) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) as total FROM ${tabla}`);
        info.tablas.push({
          nombre: tabla,
          registros: parseInt(countResult.rows[0].total)
        });
      } catch {
        info.tablas.push({ nombre: tabla, registros: 0, error: true });
      }
    }

    // Fecha del servidor
    const fechaResult = await pool.query('SELECT NOW() as fecha');
    info.fecha_servidor = fechaResult.rows[0].fecha;

    res.json(info);

  } catch (error: any) {
    res.status(500).json({ error: 'Error al obtener información', details: error.message });
  }
});

export default router;
