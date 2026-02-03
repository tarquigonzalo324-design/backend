import { Request, Response } from 'express';
import pool from '../config/database';

// Crear hoja de ruta
export const crearHojaRuta = async (req: Request, res: Response) => {
  try {
    const {
      numero_hr, referencia, procedencia, fecha_limite, cite, numero_fojas, prioridad, estado, observaciones, usuario_creador_id,
      // Nuevos campos
      nombre_solicitante, telefono_celular, ubicacion_actual, responsable_actual,
      // Todos los campos extra del formulario
      destino_principal, destinos, instrucciones_adicionales,
      // Secciones adicionales individuales (formato legacy)
      fecha_enviado_1, fecha_recepcion_1, destino_1, destinos_1, instrucciones_adicionales_1,
      fecha_enviado_2, fecha_recepcion_2, destino_2, destinos_2, instrucciones_adicionales_2,
      fecha_enviado_3, fecha_recepcion_3, destino_3, destinos_3, instrucciones_adicionales_3,
      // Secciones adicionales como array (nuevo formato)
      secciones_adicionales
    } = req.body;

    // Guardar todos los datos extra en detalles (JSONB)
    const detalles = {
      destino_principal, destinos, instrucciones_adicionales,
      // Formato legacy para compatibilidad
      fecha_enviado_1, fecha_recepcion_1, destino_1, destinos_1, instrucciones_adicionales_1,
      fecha_enviado_2, fecha_recepcion_2, destino_2, destinos_2, instrucciones_adicionales_2,
      fecha_enviado_3, fecha_recepcion_3, destino_3, destinos_3, instrucciones_adicionales_3,
      // Nuevo formato: array de secciones
      secciones_adicionales: secciones_adicionales || []
    };

    console.log('🏗️ === CREANDO HOJA DE RUTA ===');
    console.log('📋 Ubicación recibida:', ubicacion_actual);
    console.log('👤 Responsable recibido:', responsable_actual);
    console.log('🎯 Destino principal:', destino_principal);

    // Mapear estado del frontend a estado_cumplimiento del backend
    const mapaEstadoCumplimiento: { [key: string]: string } = {
      'pendiente': 'pendiente',
      'enviada': 'en_proceso',
      'en_proceso': 'en_proceso', 
      'finalizada': 'completado',
      'archivada': 'completado'
    };
    
    const estado_cumplimiento = mapaEstadoCumplimiento[estado] || 'pendiente';

    // Usar valores enviados desde frontend o valores por defecto
    const ubicacionFinal = ubicacion_actual || 'SEDEGES - Sede Central';
    const responsableFinal = responsable_actual || 'Sistema SEDEGES';

    console.log('📍 Ubicación final:', ubicacionFinal);
    console.log('👥 Responsable final:', responsableFinal);

    const result = await pool.query(
      `INSERT INTO hojas_ruta (numero_hr, referencia, procedencia, fecha_limite, cite, numero_fojas, prioridad, estado, observaciones, usuario_creador_id, nombre_solicitante, telefono_celular, detalles, estado_cumplimiento, ubicacion_actual, responsable_actual)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [numero_hr, referencia, procedencia, fecha_limite, cite, numero_fojas, prioridad, estado, observaciones, usuario_creador_id, nombre_solicitante, telefono_celular, detalles, estado_cumplimiento, ubicacionFinal, responsableFinal]
    );

    console.log('✅ Hoja creada con ubicación:', result.rows[0].ubicacion_actual);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear hoja de ruta:', error);
    res.status(500).json({ error: 'Error al crear hoja de ruta' });
  }
};

// Listar/buscar hojas de ruta con filtros de estado
export const listarHojasRuta = async (req: Request, res: Response) => {
  try {
    const { query, estado_cumplimiento, incluir_completadas } = req.query;
    let sqlQuery = `
      SELECT *, 
             CASE 
               WHEN dias_para_vencimiento < 0 THEN 'Vencida'
               WHEN dias_para_vencimiento <= 3 THEN 'Crítica'
               WHEN dias_para_vencimiento <= 7 THEN 'Próxima a vencer'
               ELSE 'Normal'
             END as alerta_vencimiento
      FROM hojas_ruta 
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    // Filtro por búsqueda de texto - EXPANDIDO
    if (query) {
      paramCount++;
      sqlQuery += ` AND (
        numero_hr ILIKE $${paramCount} OR 
        referencia ILIKE $${paramCount} OR 
        procedencia ILIKE $${paramCount} OR
        ubicacion_actual ILIKE $${paramCount} OR
        nombre_solicitante ILIKE $${paramCount} OR
        telefono_celular ILIKE $${paramCount}
      )`;
      params.push(`%${query}%`);
      console.log(`🔍 Búsqueda expandida por: "${query}" en múltiples campos`);
    }

    // Filtro por estado de cumplimiento
    if (estado_cumplimiento) {
      paramCount++;
      sqlQuery += ` AND estado_cumplimiento = $${paramCount}`;
      params.push(estado_cumplimiento);
    }

    // Opción para excluir completadas si se especifica explícitamente
    if (incluir_completadas === 'false') {
      sqlQuery += ` AND estado_cumplimiento != 'completado' AND estado != 'finalizada' AND estado != 'archivada'`;
    }

    sqlQuery += ` ORDER BY 
      CASE WHEN estado_cumplimiento = 'vencido' THEN 1
           WHEN prioridad = 'urgente' THEN 2
           WHEN prioridad = 'prioritario' THEN 3
           ELSE 4 END,
      dias_para_vencimiento ASC NULLS LAST,
      fecha_ingreso DESC`;

    const result = await pool.query(sqlQuery, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al listar hojas de ruta:', error);
    res.status(500).json({ error: 'Error al listar hojas de ruta' });
  }
};

// Obtener detalle de hoja de ruta
export const obtenerHojaRuta = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 Obteniendo hoja de ruta con ID:', id);
    
    const result = await pool.query('SELECT * FROM hojas_ruta WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      console.log('❌ Hoja de ruta no encontrada con ID:', id);
      return res.status(404).json({ 
        success: false, 
        message: 'Hoja de ruta no encontrada' 
      });
    }
    
    const hoja = result.rows[0];
    
    console.log('✅ Hoja de ruta encontrada:', {
      id: hoja.id,
      numero_hr: hoja.numero_hr,
      referencia: hoja.referencia,
      estado: hoja.estado
    });
    
    // Combinar los campos principales y los detalles (si existen)
    let fullData = { ...hoja };
    if (hoja.detalles) {
      try {
        // detalles ya es objeto si viene de pg
        fullData = { ...hoja, ...hoja.detalles };
      } catch (error) {
        console.warn('Error al procesar detalles:', error);
      }
    }
    
    res.json({ 
      success: true, 
      hoja: fullData 
    });
  } catch (error) {
    console.error('❌ Error al obtener hoja de ruta:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor al obtener hoja de ruta' 
    });
  }
};

// Actualizar hoja de ruta completa
export const actualizarHojaRuta = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    console.log('🔄 Actualizando hoja de ruta ID:', id);
    console.log('📝 Datos a actualizar:', JSON.stringify(updateData, null, 2));
    
    // Separar campos principales de los detalles
    const {
      // Campos principales
      numero_hr, referencia, procedencia, fecha_limite, cite, numero_fojas, 
      prioridad, estado, observaciones, nombre_solicitante, telefono_celular,
      // Todo lo demás va a detalles
      ...detalles
    } = updateData;
    
    // Construir query dinámicamente
    const fieldsToUpdate: string[] = [];
    const values: any[] = [];
    let paramCount = 1;
    
    // Agregar campos principales si están presentes
    if (numero_hr !== undefined) {
      fieldsToUpdate.push(`numero_hr = $${paramCount++}`);
      values.push(numero_hr);
    }
    if (referencia !== undefined) {
      fieldsToUpdate.push(`referencia = $${paramCount++}`);
      values.push(referencia);
    }
    if (procedencia !== undefined) {
      fieldsToUpdate.push(`procedencia = $${paramCount++}`);
      values.push(procedencia);
    }
    if (fecha_limite !== undefined) {
      fieldsToUpdate.push(`fecha_limite = $${paramCount++}`);
      values.push(fecha_limite);
    }
    if (cite !== undefined) {
      fieldsToUpdate.push(`cite = $${paramCount++}`);
      values.push(cite);
    }
    if (numero_fojas !== undefined) {
      fieldsToUpdate.push(`numero_fojas = $${paramCount++}`);
      values.push(numero_fojas);
    }
    if (prioridad !== undefined) {
      fieldsToUpdate.push(`prioridad = $${paramCount++}`);
      values.push(prioridad);
    }
    if (estado !== undefined) {
      fieldsToUpdate.push(`estado = $${paramCount++}`);
      values.push(estado);
    }
    if (observaciones !== undefined) {
      fieldsToUpdate.push(`observaciones = $${paramCount++}`);
      values.push(observaciones);
    }
    if (nombre_solicitante !== undefined) {
      fieldsToUpdate.push(`nombre_solicitante = $${paramCount++}`);
      values.push(nombre_solicitante);
    }
    if (telefono_celular !== undefined) {
      fieldsToUpdate.push(`telefono_celular = $${paramCount++}`);
      values.push(telefono_celular);
    }
    
    // Actualizar detalles si hay datos adicionales
    if (Object.keys(detalles).length > 0) {
      fieldsToUpdate.push(`detalles = $${paramCount++}`);
      values.push(detalles);
    }
    
    // Siempre actualizar timestamp
    fieldsToUpdate.push(`updated_at = CURRENT_TIMESTAMP`);
    
    if (fieldsToUpdate.length === 1) { // Solo updated_at
      return res.status(400).json({ 
        success: false, 
        message: 'No hay datos para actualizar' 
      });
    }
    
    // Agregar ID al final
    values.push(id);
    
    const updateQuery = `
      UPDATE hojas_ruta 
      SET ${fieldsToUpdate.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    console.log('📝 Query de actualización:', updateQuery);
    console.log('📝 Valores:', values);
    
    const result = await pool.query(updateQuery, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Hoja de ruta no encontrada' 
      });
    }
    
    console.log('✅ Hoja de ruta actualizada exitosamente');
    
    res.json({ 
      success: true, 
      hoja: result.rows[0],
      message: 'Hoja de ruta actualizada exitosamente'
    });
    
  } catch (error) {
    console.error('❌ Error al actualizar hoja de ruta:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor' 
    });
  }
};

// Marcar hoja de ruta como completada
export const marcarCompletada = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE hojas_ruta 
       SET estado_cumplimiento = 'completado', 
           fecha_completado = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Hoja de ruta no encontrada' });
    }

    // Crear notificación de completado
    const hoja = result.rows[0];
    await pool.query(
      `INSERT INTO notificaciones (hoja_ruta_id, usuario_id, tipo, mensaje)
       VALUES ($1, $2, 'completado', $3)`,
      [id, hoja.usuario_creador_id, `✅ Hoja de Ruta #${hoja.numero_hr} marcada como COMPLETADA`]
    );

    res.json({ message: 'Hoja de ruta marcada como completada', hoja: result.rows[0] });
  } catch (error) {
    console.error('Error al marcar como completada:', error);
    res.status(500).json({ error: 'Error al marcar como completada' });
  }
};

// Cambiar estado de cumplimiento
export const cambiarEstadoCumplimiento = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { estado_cumplimiento, estado } = req.body; // Agregar estado
    
    console.log('🎯 === INICIO CAMBIAR ESTADO ===');
    console.log('📝 URL params - ID:', id);
    console.log('📝 Request body completo:', JSON.stringify(req.body, null, 2));
    console.log('📝 estado_cumplimiento:', estado_cumplimiento);
    console.log('📝 estado:', estado);
    console.log('📝 Tipo de estado_cumplimiento:', typeof estado_cumplimiento);
    
    // Validar estado
    const estadosValidos = ['pendiente', 'en_proceso', 'completado', 'vencido'];
    console.log('🔍 Estados válidos:', estadosValidos);
    console.log('🔍 ¿Estado válido?', estadosValidos.includes(estado_cumplimiento));
    
    if (!estado_cumplimiento) {
      console.log('❌ No se recibió estado_cumplimiento');
      return res.status(400).json({ error: 'Falta el campo estado_cumplimiento' });
    }
    
    if (!estadosValidos.includes(estado_cumplimiento)) {
      console.log('❌ Estado inválido recibido:', estado_cumplimiento);
      return res.status(400).json({ 
        error: `Estado inválido: "${estado_cumplimiento}". Estados permitidos: ${estadosValidos.join(', ')}` 
      });
    }

    console.log('✅ Validación pasó, ejecutando query...');

    // Actualizar tanto estado_cumplimiento como estado si se proporciona
    let updateQuery = `UPDATE hojas_ruta 
                       SET estado_cumplimiento = $1,
                           updated_at = CURRENT_TIMESTAMP`;
    let queryParams = [estado_cumplimiento];
    
    if (estado) {
      updateQuery += `, estado = $${queryParams.length + 1}`;
      queryParams.push(estado);
    }
    
    updateQuery += ` WHERE id = $${queryParams.length + 1} RETURNING *`;
    queryParams.push(id);
    
    console.log('📝 Query final:', updateQuery);
    console.log('📝 Params:', queryParams);
    
    const result = await pool.query(updateQuery, queryParams);
    
    // Si es completado, actualizar fecha_completado en una query separada
    if (estado_cumplimiento === 'completado') {
      await pool.query(
        `UPDATE hojas_ruta 
         SET fecha_completado = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id]
      );
    }
    
    console.log('📊 Resultado de la query:', {
      rowsAffected: result.rowCount,
      rowsReturned: result.rows.length
    });
    
    if (result.rows.length === 0) {
      console.log('❌ Hoja de ruta no encontrada con ID:', id);
      return res.status(404).json({ error: 'Hoja de ruta no encontrada' });
    }

    console.log('✅ Estado actualizado exitosamente:', {
      id: result.rows[0].id,
      nuevo_estado: result.rows[0].estado_cumplimiento,
      fecha_updated: result.rows[0].updated_at
    });
    console.log('🎯 === FIN CAMBIAR ESTADO ===');
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error al cambiar estado:', error);
    res.status(500).json({ error: 'Error al cambiar estado' });
  }
};

// Obtener estadísticas del dashboard
export const obtenerEstadisticas = async (req: Request, res: Response) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE estado_cumplimiento = 'pendiente') as pendientes,
        COUNT(*) FILTER (WHERE estado_cumplimiento = 'en_proceso') as en_proceso,
        COUNT(*) FILTER (WHERE estado_cumplimiento = 'completado') as completadas,
        COUNT(*) FILTER (WHERE estado_cumplimiento = 'vencido') as vencidas,
        COUNT(*) FILTER (WHERE dias_para_vencimiento <= 3 AND estado_cumplimiento != 'completado') as criticas,
        COUNT(*) FILTER (WHERE dias_para_vencimiento <= 7 AND dias_para_vencimiento > 3 AND estado_cumplimiento != 'completado') as proximas_vencer
      FROM hojas_ruta
      WHERE estado != 'cancelada'
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
};

// Obtener hojas por vencer (para dashboard)
export const obtenerHojasPorVencer = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT * FROM hojas_por_vencer 
      WHERE estado_cumplimiento != 'completado'
      ORDER BY dias_para_vencimiento ASC
      LIMIT 10
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener hojas por vencer:', error);
    res.status(500).json({ error: 'Error al obtener hojas por vencer' });
  }
};

// Cambiar ubicación de hoja de ruta
export const cambiarUbicacion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { ubicacion_actual, responsable_actual } = req.body;

    const result = await pool.query(
      `UPDATE hojas_ruta 
       SET ubicacion_actual = $1, responsable_actual = $2, actualizado_en = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [ubicacion_actual, responsable_actual, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Hoja de ruta no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al cambiar ubicación:', error);
    res.status(500).json({ error: 'Error al cambiar ubicación' });
  }
};

// Cambiar estado completo de hoja de ruta (nuevo)
export const cambiarEstadoCompleto = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { estado_cumplimiento, estado_detalle } = req.body;

    // Usar la función de PostgreSQL que creamos
    const result = await pool.query(
      `SELECT cambiar_estado_hoja($1, $2, $3, $4) as resultado`,
      [id, estado_cumplimiento, estado_detalle, 1] // usuario_id = 1 por ahora
    );

    const resultado = result.rows[0].resultado;
    
    if (resultado.success) {
      // Obtener la hoja actualizada
      const hojaActualizada = await pool.query(
        'SELECT * FROM dashboard_hojas_recientes WHERE id = $1',
        [id]
      );
      
      res.json({
        success: true,
        mensaje: resultado.mensaje,
        hoja: hojaActualizada.rows[0]
      });
    } else {
      res.status(400).json(resultado);
    }
  } catch (error) {
    console.error('Error al cambiar estado completo:', error);
    res.status(500).json({ error: 'Error al cambiar estado' });
  }
};

// Obtener dashboard con datos en tiempo real (nuevo)
export const obtenerDashboardTiempoReal = async (req: Request, res: Response) => {
  try {
    // Hojas recientes (últimas 10)
    const hojasRecientes = await pool.query(`
      SELECT * FROM dashboard_hojas_recientes 
      WHERE estado_cumplimiento != 'completado'
      ORDER BY created_at DESC 
      LIMIT 10
    `);

    // Estadísticas en tiempo real
    const estadisticas = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE estado_cumplimiento = 'pendiente') as pendientes,
        COUNT(*) FILTER (WHERE estado_cumplimiento = 'en_proceso') as en_proceso,
        COUNT(*) FILTER (WHERE estado_cumplimiento = 'completado') as completadas,
        COUNT(*) FILTER (WHERE estado_cumplimiento = 'vencido') as vencidas,
        COUNT(*) FILTER (WHERE estado_cumplimiento = 'cancelado') as canceladas,
        COUNT(*) FILTER (WHERE estado_cumplimiento = 'erroneo') as erroneas,
        COUNT(*) FILTER (WHERE dias_para_vencimiento <= 3 AND estado_cumplimiento NOT IN ('completado', 'cancelado')) as criticas
      FROM hojas_ruta
      WHERE estado != 'eliminado'
    `);

    // Notificaciones no leídas (últimas 10)
    const notificaciones = await pool.query(`
      SELECT * FROM notificaciones 
      WHERE leida = false
      ORDER BY fecha_creacion DESC 
      LIMIT 10
    `);

    // Tareas pendientes (MEJORADO para incluir rutinarios)
    const tareasPendientes = await pool.query(`
      SELECT 
        id,
        numero_hr,
        referencia,
        procedencia,
        prioridad,
        dias_para_vencimiento,
        fecha_limite,
        estado_cumplimiento,
        icono_estado
      FROM dashboard_hojas_recientes 
      WHERE estado_cumplimiento NOT IN ('completado', 'cancelado') 
        AND (dias_para_vencimiento <= 30 OR dias_para_vencimiento IS NULL)
      ORDER BY 
        CASE 
          WHEN dias_para_vencimiento < 0 THEN 1
          WHEN dias_para_vencimiento <= 3 THEN 2  
          WHEN dias_para_vencimiento <= 7 THEN 3
          WHEN dias_para_vencimiento <= 30 THEN 4
          ELSE 5
        END,
        dias_para_vencimiento ASC NULLS LAST
      LIMIT 20
    `);

    res.json({
      hojas_recientes: hojasRecientes.rows,
      estadisticas: estadisticas.rows[0],
      notificaciones: notificaciones.rows,
      tareas_pendientes: tareasPendientes.rows
    });

  } catch (error) {
    console.error('Error al obtener dashboard tiempo real:', error);
    res.status(500).json({ error: 'Error al obtener datos del dashboard' });
  }
};

// Actualizar estado de hoja de ruta
export const actualizarEstadoHojaRuta = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    // Validar que el estado sea válido - Flujo: Pendiente → Enviada → En Proceso → Finalizada → Archivada
    const estadosPermitidos = ['pendiente', 'enviada', 'en_proceso', 'finalizada', 'archivada'];
    if (!estadosPermitidos.includes(estado)) {
      return res.status(400).json({ error: 'Estado no válido. Estados permitidos: ' + estadosPermitidos.join(', ') });
    }

    const result = await pool.query(
      'UPDATE hojas_ruta SET estado = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [estado, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Hoja de ruta no encontrada' });
    }

    res.json({ 
      message: 'Estado actualizado correctamente',
      hoja: result.rows[0] 
    });
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ error: 'Error al actualizar el estado' });
  }
};

// Obtener lista de destinos/centros
export const obtenerDestinos = async (req: Request, res: Response) => {
  try {
    const { tipo } = req.query; // 'centro_acogida', 'direccion', 'departamento', 'externo', 'all'
    
    let query = 'SELECT id, nombre, descripcion, tipo FROM destinos WHERE activo = true';
    const params: any[] = [];
    
    if (tipo && tipo !== 'all') {
      query += ' AND tipo = $1';
      params.push(tipo);
    }
    
    query += ' ORDER BY nombre ASC';
    
    const result = await pool.query(query, params);
    
    console.log('✅ Destinos obtenidos:', result.rows.length);
    
    res.json({
      success: true,
      destinos: result.rows
    });
    
  } catch (error) {
    console.error('❌ Error al obtener destinos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener destinos'
    });
  }
};
