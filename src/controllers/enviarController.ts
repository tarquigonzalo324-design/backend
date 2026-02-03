import { Request, Response } from 'express';
import pool from '../config/database';

interface AuthRequest extends Request {
  userId?: number;
}

export const enviarAUnidad = async (req: AuthRequest, res: Response) => {
  try {
    const usuarioId = req.userId;
    const { hoja_id, unidad_id, observaciones, instrucciones, prioridad, auto_fill_seccion, fecha_enviado, destino, destinos_checkboxes } = req.body || {};

    console.log('📨 Datos recibidos en enviarAUnidad:', { hoja_id, unidad_id, fecha_enviado, destino, auto_fill_seccion });

    if (!hoja_id || !unidad_id) {
      return res.status(400).json({ error: 'hoja_id y unidad_id son requeridos' });
    }

    const unidadResult = await pool.query('SELECT nombre FROM unidades WHERE id = $1 AND activo = true', [unidad_id]);
    if (unidadResult.rows.length === 0) {
      return res.status(404).json({ error: 'Unidad no encontrada' });
    }
    const nombreUnidad = unidadResult.rows[0].nombre;

    // Si auto_fill_seccion es true, actualizar la siguiente sección vacía en detalles
    if (auto_fill_seccion) {
      const hojaResult = await pool.query('SELECT detalles FROM hojas_ruta WHERE id = $1', [hoja_id]);
      if (hojaResult.rows.length > 0) {
        let detalles = hojaResult.rows[0].detalles || {};
        
        // Limpiar secciones_adicionales: quitar elementos vacíos o sin número de sección válido
        let seccionesAdicionales = (detalles.secciones_adicionales || []).filter((s: any) => {
          // Solo mantener secciones que tengan número válido Y contenido
          return s && s.seccion && (s.fecha_enviado || s.destino);
        });
        
        // Encontrar la siguiente sección vacía (1-10)
        let seccionLlena = -1;
        for (let i = 1; i <= 10; i++) {
          const fechaKey = `fecha_enviado_${i}`;
          const destinoKey = `destino_${i}`;
          
          // Verificar si la sección está vacía
          const seccionEnArray = seccionesAdicionales.find((s: any) => s.seccion === i);
          const tieneFecha = detalles[fechaKey] || seccionEnArray?.fecha_enviado;
          const tieneDestino = detalles[destinoKey] || seccionEnArray?.destino;
          
          if (!tieneFecha && !tieneDestino) {
            // Esta sección está vacía, la llenamos
            seccionLlena = i;
            break;
          }
        }
        
        if (seccionLlena > 0) {
          // Usar fecha local para evitar desfase de timezone
          const hoy = new Date();
          const fechaLocalDefault = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
          const fechaEnvioStr = fecha_enviado || fechaLocalDefault;
          const destinoStr = destino || nombreUnidad;
          const checkboxesArray = destinos_checkboxes || [];
          
          console.log(`📅 Guardando sección ${seccionLlena}: fecha_recibida="${fecha_enviado}", fecha_usada="${fechaEnvioStr}", destino="${destinoStr}"`);
          
          // Actualizar en detalles
          detalles[`fecha_enviado_${seccionLlena}`] = fechaEnvioStr;
          detalles[`destino_${seccionLlena}`] = destinoStr;
          if (observaciones) {
            detalles[`instrucciones_${seccionLlena}`] = observaciones;
          }
          
          // También actualizar secciones_adicionales array si existe
          const existeEnArray = seccionesAdicionales.findIndex((s: any) => s.seccion === seccionLlena);
          if (existeEnArray >= 0) {
            seccionesAdicionales[existeEnArray] = {
              ...seccionesAdicionales[existeEnArray],
              fecha_enviado: fechaEnvioStr,
              destino: destinoStr,
              destinos: checkboxesArray,
              instrucciones_adicionales: observaciones || seccionesAdicionales[existeEnArray].instrucciones_adicionales
            };
          } else {
            seccionesAdicionales.push({
              seccion: seccionLlena,
              fecha_enviado: fechaEnvioStr,
              destino: destinoStr,
              destinos: checkboxesArray,
              instrucciones_adicionales: observaciones || ''
            });
          }
          
          detalles.secciones_adicionales = seccionesAdicionales;
          
          await pool.query(
            'UPDATE hojas_ruta SET detalles = $1, actualizado_en = now() WHERE id = $2',
            [JSON.stringify(detalles), hoja_id]
          );
          
          console.log(`📝 Sección ${seccionLlena} llenada automáticamente para hoja ${hoja_id}`);
        }
      }
    }

    const insertQuery = `
      INSERT INTO envios (hoja_id, usuario_id, unidad_destino_id, destinatario_nombre, observaciones, instrucciones, estado, fecha_envio, creado_en)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'enviado', now(), now())
      RETURNING *;
    `;
    const result = await pool.query(insertQuery, [
      hoja_id,
      usuarioId,
      unidad_id,
      nombreUnidad,
      observaciones || null,
      instrucciones ? JSON.stringify(instrucciones) : '[]'
    ]);

    await pool.query(
      `UPDATE hojas_ruta SET estado = 'enviada', unidad_actual_id = $1, ubicacion_actual = $2, actualizado_en = now() WHERE id = $3`,
      [unidad_id, nombreUnidad, hoja_id]
    );

    await pool.query(
      `INSERT INTO progreso_hojas_ruta (hoja_ruta_id, unidad_destino_id, ubicacion_actual, accion, responsable_id, notas)
       VALUES ($1, $2, $3, 'enviado', $4, $5)`,
      [hoja_id, unidad_id, 'Enviado a ' + nombreUnidad, usuarioId, observaciones || 'Envio inicial']
    );

    return res.status(201).json({ 
      success: true, 
      envio: result.rows[0],
      mensaje: `Documento enviado a ${nombreUnidad}`
    });
  } catch (err: any) {
    console.error('Error al enviar a unidad:', err);
    return res.status(500).json({ error: 'Error al enviar documento' });
  }
};

export const crearEnvio = async (req: AuthRequest, res: Response) => {
  try {
    const usuarioId = req.userId;
    const { 
      hoja_id, 
      destinatario_nombre, 
      destinatario_correo, 
      destinatario_numero, 
      destino_id,
      comentarios, 
      archivos,
      marcar_como_enviado = true // Por defecto marcar como enviado
    } = req.body || {};

    console.log('📤 Creando envío:', { 
      usuarioId, 
      hoja_id, 
      destinatario_nombre,
      destinatario_correo,
      destinatario_numero,
      destino_id,
      marcar_como_enviado
    });

    // Validar campos requeridos
    if (!destinatario_nombre) {
      return res.status(400).json({ error: 'El nombre del destinatario es requerido' });
    }

    // Procesar archivos como JSON
    const archivosJson = archivos ? JSON.stringify(archivos) : '[]';

    // Determinar estado inicial
    const estadoInicial = marcar_como_enviado ? 'enviado' : 'pendiente';
    const fechaEnvio = marcar_como_enviado ? 'now()' : 'NULL';

    // Insertar en tabla envios con nueva estructura
    const insertQuery = `
      INSERT INTO envios (
        hoja_id, 
        usuario_id, 
        destinatario_nombre, 
        destinatario_email, 
        destinatario_telefono, 
        destino_id,
        instrucciones, 
        observaciones,
        estado,
        fecha_envio, 
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, ${fechaEnvio}, now())
      RETURNING *;
    `;

    const values = [
      hoja_id || null, 
      usuarioId, 
      destinatario_nombre.trim(), 
      destinatario_correo?.trim() || null,
      destinatario_numero?.trim() || null,
      destino_id || null,
      archivosJson, 
      comentarios?.trim() || null,
      estadoInicial
    ];

    const result = await pool.query(insertQuery, values);
    
    console.log('✅ Envío creado exitosamente:', result.rows[0]);

    // Si se marcó como enviado, obtener información del destino para el mensaje
    let mensajeExito = 'Envío registrado correctamente';
    if (marcar_como_enviado && destino_id) {
      try {
        const destinoQuery = 'SELECT nombre FROM destinos WHERE id = $1';
        const destinoResult = await pool.query(destinoQuery, [destino_id]);
        if (destinoResult.rows.length > 0) {
          mensajeExito = `Documento enviado exitosamente a: ${destinoResult.rows[0].nombre}`;
        }
      } catch (err) {
        console.warn('⚠️ No se pudo obtener nombre del destino:', err);
      }
    }

    return res.status(201).json({ 
      success: true, 
      envio: result.rows[0],
      mensaje: mensajeExito
    });

  } catch (err: any) {
    console.error('❌ Error al crear envío:', err);
    
    // Tabla envios no existe
    if (err.code === '42P01') {
      return res.status(501).json({ 
        error: 'La tabla envios no existe. Ejecuta la migración 007_reestructurar_tabla_envios.sql' 
      });
    }
    
    // Error de foreign key
    if (err.code === '23503') {
      if (err.detail?.includes('destino_id')) {
        return res.status(400).json({ 
          error: 'El destino especificado no existe' 
        });
      }
      if (err.detail?.includes('hoja_id')) {
        return res.status(400).json({ 
          error: 'La hoja de ruta especificada no existe' 
        });
      }
    }

    return res.status(500).json({ 
      error: 'Error interno del servidor al crear envío',
      detalle: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// GET /api/enviar - Listar envíos
export const listarEnvios = async (req: AuthRequest, res: Response) => {
  try {
    const query = `
      SELECT 
        e.*,
        hr.numero_hr,
        hr.referencia,
        d.nombre as destino_nombre,
        u.nombre_completo as usuario_nombre
      FROM envios e
      LEFT JOIN hojas_ruta hr ON e.hoja_id = hr.id
      LEFT JOIN destinos d ON e.destino_id = d.id
      LEFT JOIN usuarios u ON e.usuario_id = u.id
      ORDER BY e.created_at DESC
    `;

    const result = await pool.query(query);
    
    console.log('📋 Listando envíos:', result.rows.length);

    return res.status(200).json({ 
      success: true, 
      envios: result.rows
    });

  } catch (err: any) {
    console.error('❌ Error al listar envíos:', err);
    return res.status(500).json({ 
      error: 'Error interno del servidor al listar envíos',
      detalle: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// PUT /api/enviar/:id/estado - Actualizar estado de envío
export const actualizarEstadoEnvio = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { estado, fecha_entrega } = req.body;

    console.log('🔄 === INICIO ACTUALIZACIÓN ESTADO ===');
    console.log('🔄 Datos recibidos:', { id, estado, fecha_entrega });

    // Validar que el ID sea un número válido
    if (!id || isNaN(Number(id))) {
      console.log('❌ ID inválido:', id);
      return res.status(400).json({ error: 'ID de envío inválido' });
    }

    // Validar estado
    const estadosValidos = ['registrado', 'enviado', 'entregado', 'cancelado'];
    if (!estado || !estadosValidos.includes(estado)) {
      console.log('❌ Estado inválido:', estado);
      return res.status(400).json({ 
        error: 'Estado inválido. Debe ser: ' + estadosValidos.join(', ') 
      });
    }

    // Primero obtener el envío actual para debug
    const selectQuery = 'SELECT * FROM envios WHERE id = $1';
    const selectResult = await pool.query(selectQuery, [Number(id)]);
    
    if (selectResult.rows.length === 0) {
      console.log('❌ Envío no encontrado con ID:', id);
      return res.status(404).json({ error: 'Envío no encontrado' });
    }

    console.log('📋 Envío actual:', selectResult.rows[0]);

    // Construir la query de actualización simplificada
    let updateQuery: string;
    let values: any[];

    if (estado === 'enviado') {
      // Para estado enviado, también actualizar fecha_envio
      updateQuery = `UPDATE envios SET estado = $1, fecha_envio = COALESCE(fecha_envio, now()), updated_at = now() WHERE id = $2 RETURNING *`;
      values = [estado, Number(id)];
    } else if (estado === 'recibido' && fecha_entrega) {
      updateQuery = `UPDATE envios SET estado = $1, fecha_recepcion = $2, updated_at = now() WHERE id = $3 RETURNING *`;
      values = [estado, fecha_entrega, Number(id)];
    } else {
      updateQuery = `UPDATE envios SET estado = $1, updated_at = now() WHERE id = $2 RETURNING *`;
      values = [estado, Number(id)];
    }

    console.log('📝 Query a ejecutar:', updateQuery);
    console.log('📝 Valores:', values);

    const result = await pool.query(updateQuery, values);

    if (result.rows.length === 0) {
      console.log('❌ No se pudo actualizar, envío no encontrado');
      return res.status(404).json({ error: 'Envío no encontrado' });
    }

    console.log('✅ Estado actualizado exitosamente:', result.rows[0]);

    return res.status(200).json({ 
      success: true, 
      envio: result.rows[0],
      mensaje: `Envío marcado como ${estado}`
    });

  } catch (err: any) {
    console.error('❌ === ERROR COMPLETO ===');
    console.error('❌ Mensaje:', err.message);
    console.error('❌ Código:', err.code);
    console.error('❌ Detalle:', err.detail);
    console.error('❌ Stack:', err.stack);
    
    // Errores específicos de PostgreSQL
    if (err.code === '23503') {
      return res.status(400).json({ 
        error: 'Error de referencia: verifique que el envío y destino existan',
        detalle: err.detail
      });
    }

    if (err.code === '23514') {
      return res.status(400).json({ 
        error: 'Estado inválido según las restricciones de la base de datos',
        detalle: err.detail
      });
    }

    return res.status(500).json({ 
      error: 'Error interno del servidor al actualizar estado',
      detalle: err.message,
      codigo: err.code
    });
  }
};

// GET /api/enviar/destinos - Obtener destinos disponibles
export const obtenerDestinos = async (req: AuthRequest, res: Response) => {
  try {
    // Destinos por defecto (ya que la tabla locaciones no existe)
    const destinosDefault = [
      { id: 1, nombre: 'SEDEGES - Sede Central', descripcion: 'Sede Central SEDEGES', tipo: 'sede' },
      { id: 2, nombre: 'Hogar de Niños', descripcion: 'Centro de Acogida', tipo: 'centro_acogida' },
      { id: 3, nombre: 'Hogar de Niñas', descripcion: 'Centro de Acogida', tipo: 'centro_acogida' },
      { id: 4, nombre: 'Centro del Adulto Mayor', descripcion: 'Centro de Acogida', tipo: 'centro_acogida' },
      { id: 5, nombre: 'Centro de Rehabilitación', descripcion: 'Centro de Acogida', tipo: 'centro_acogida' }
    ];

    // Intentar obtener de las unidades si existen
    try {
      const unidadesResult = await pool.query(
        'SELECT id, nombre, descripcion FROM unidades WHERE activo = true ORDER BY nombre'
      );
      if (unidadesResult.rows.length > 0) {
        const destinos = unidadesResult.rows.map((u: any) => ({
          id: u.id,
          nombre: u.nombre,
          descripcion: u.descripcion || '',
          tipo: 'unidad'
        }));
        return res.status(200).json({ success: true, destinos });
      }
    } catch (dbError) {
      console.log('Usando destinos por defecto');
    }

    return res.status(200).json({ 
      success: true, 
      destinos: destinosDefault
    });

  } catch (err: any) {
    console.error('Error al obtener destinos:', err);
    return res.status(500).json({ 
      error: 'Error interno del servidor al obtener destinos',
      detalle: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

export const obtenerEnviosMiUnidad = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    
    // Deshabilitar caché para asegurar datos frescos
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    const userQuery = await pool.query('SELECT unidad_id FROM usuarios WHERE id = $1', [userId]);
    if (userQuery.rows.length === 0 || !userQuery.rows[0].unidad_id) {
      return res.status(200).json({ success: true, envios: [] });
    }
    
    const unidadId = userQuery.rows[0].unidad_id;
    console.log(`📬 Obteniendo envíos para unidad ${unidadId} (usuario ${userId})`);
    
    const query = `
      SELECT 
        e.id, e.hoja_id, e.estado, e.observaciones, e.respuesta,
        e.fecha_envio, e.fecha_recepcion, e.fecha_respuesta,
        e.instrucciones, e.destinatario_nombre,
        hr.numero_hr, hr.referencia, hr.procedencia, hr.prioridad
      FROM envios e
      INNER JOIN hojas_ruta hr ON e.hoja_id = hr.id
      WHERE e.unidad_destino_id = $1 AND e.eliminado_en IS NULL
      ORDER BY e.fecha_envio DESC
    `;
    
    const result = await pool.query(query, [unidadId]);
    console.log(`📬 Encontrados ${result.rows.length} envíos para unidad ${unidadId}`);
    
    return res.status(200).json({ success: true, envios: result.rows });
  } catch (err: any) {
    console.error('Error al obtener envios de unidad:', err);
    return res.status(500).json({ error: 'Error al obtener envios' });
  }
};

export const marcarRecibido = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    const result = await pool.query(
      `UPDATE envios SET estado = 'recibido', fecha_recepcion = now(), actualizado_en = now() 
       WHERE id = $1 RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Envio no encontrado' });
    }
    
    const envio = result.rows[0];
    
    // Obtener nombre de la unidad para buscar la sección correspondiente
    const unidadResult = await pool.query('SELECT nombre FROM unidades WHERE id = $1', [envio.unidad_destino_id]);
    const nombreUnidad = unidadResult.rows[0]?.nombre || 'Unidad';
    
    // Buscar la sección que corresponde a este envío y actualizar su fecha_recepcion
    const hojaResult = await pool.query('SELECT detalles FROM hojas_ruta WHERE id = $1', [envio.hoja_id]);
    if (hojaResult.rows.length > 0) {
      let detalles = hojaResult.rows[0].detalles || {};
      const seccionesAdicionales = detalles.secciones_adicionales || [];
      
      // Usar fecha local para evitar desfase de timezone
      const hoy = new Date();
      const fechaRecepcionStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
      
      // Buscar la sección que tiene este destino (unidad) y no tiene fecha de recepción
      let seccionActualizada = false;
      for (let i = seccionesAdicionales.length - 1; i >= 0; i--) {
        const seccion = seccionesAdicionales[i];
        // Buscar sección que tenga el destino de esta unidad y no tenga fecha_recepcion
        if (seccion.destino && seccion.destino.includes(nombreUnidad) && !seccion.fecha_recepcion) {
          seccionesAdicionales[i].fecha_recepcion = fechaRecepcionStr;
          seccionActualizada = true;
          console.log(`Actualizada fecha_recepcion en sección ${seccion.seccion} para ${nombreUnidad}`);
          break;
        }
      }
      
      // Si no encontró sección específica, buscar por número de sección
      if (!seccionActualizada) {
        for (let i = 1; i <= 10; i++) {
          const destinoKey = `destino_${i}`;
          const destinoValor = detalles[destinoKey];
          const seccionEnArray = seccionesAdicionales.find((s: any) => s.seccion === i);
          
          if (destinoValor && destinoValor.includes(nombreUnidad) && !detalles[`fecha_recepcion_${i}`]) {
            detalles[`fecha_recepcion_${i}`] = fechaRecepcionStr;
            if (seccionEnArray && !seccionEnArray.fecha_recepcion) {
              seccionEnArray.fecha_recepcion = fechaRecepcionStr;
            }
            seccionActualizada = true;
            console.log(`Actualizada fecha_recepcion_${i} para ${nombreUnidad}`);
            break;
          }
        }
      }
      
      detalles.secciones_adicionales = seccionesAdicionales;
      
      await pool.query(
        'UPDATE hojas_ruta SET detalles = $1, actualizado_en = now() WHERE id = $2',
        [JSON.stringify(detalles), envio.hoja_id]
      );
      
      console.log(`Recepcion registrada para hoja ${envio.hoja_id} - Unidad: ${nombreUnidad}`);
    }
    
    await pool.query(
      `INSERT INTO progreso_hojas_ruta (hoja_ruta_id, ubicacion_actual, accion, responsable_id, notas, unidad_destino_id)
       VALUES ($1, 'Recibido en unidad', 'recibido', $2, 'Marcado como recibido', $3)`,
      [envio.hoja_id, userId, envio.unidad_destino_id]
    );
    
    await pool.query(
      `UPDATE hojas_ruta SET estado = 'recibida', actualizado_en = now() WHERE id = $1`,
      [envio.hoja_id]
    );
    
    return res.status(200).json({ success: true, envio: result.rows[0] });
  } catch (err: any) {
    console.error('Error al marcar recibido:', err);
    return res.status(500).json({ error: 'Error al marcar como recibido' });
  }
};

export const enviarRespuesta = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { respuesta } = req.body;
    const userId = req.userId;
    
    if (!respuesta || !respuesta.trim()) {
      return res.status(400).json({ error: 'La respuesta es requerida' });
    }
    
    const result = await pool.query(
      `UPDATE envios SET estado = 'respondido', respuesta = $1, fecha_respuesta = now(), actualizado_en = now() 
       WHERE id = $2 RETURNING *`,
      [respuesta.trim(), id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Envio no encontrado' });
    }
    
    const envio = result.rows[0];
    
    // Obtener nombre de la unidad
    const unidadResult = await pool.query('SELECT nombre FROM unidades WHERE id = $1', [envio.unidad_destino_id]);
    const nombreUnidad = unidadResult.rows[0]?.nombre || 'Unidad';
    
    // Actualizar la siguiente sección disponible con la respuesta
    const hojaResult = await pool.query('SELECT detalles FROM hojas_ruta WHERE id = $1', [envio.hoja_id]);
    if (hojaResult.rows.length > 0) {
      let detalles = hojaResult.rows[0].detalles || {};
      const seccionesAdicionales = detalles.secciones_adicionales || [];
      
      // Encontrar la siguiente sección vacía
      let seccionLlena = -1;
      for (let i = 1; i <= 10; i++) {
        const fechaKey = `fecha_enviado_${i}`;
        const seccionEnArray = seccionesAdicionales.find((s: any) => s.seccion === i);
        const tieneFecha = detalles[fechaKey] || seccionEnArray?.fecha_enviado;
        
        if (!tieneFecha) {
          seccionLlena = i;
          break;
        }
      }
      
      if (seccionLlena > 0) {
        // Usar fecha local para evitar desfase de timezone
        const hoy = new Date();
        const fechaRespuestaStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
        
        detalles[`fecha_enviado_${seccionLlena}`] = fechaRespuestaStr;
        detalles[`destino_${seccionLlena}`] = `RESPUESTA de ${nombreUnidad}`;
        detalles[`instrucciones_${seccionLlena}`] = respuesta.trim();
        
        const existeEnArray = seccionesAdicionales.findIndex((s: any) => s.seccion === seccionLlena);
        if (existeEnArray >= 0) {
          seccionesAdicionales[existeEnArray] = {
            ...seccionesAdicionales[existeEnArray],
            fecha_enviado: fechaRespuestaStr,
            destino: `RESPUESTA de ${nombreUnidad}`,
            instrucciones_adicionales: respuesta.trim()
          };
        } else {
          seccionesAdicionales.push({
            seccion: seccionLlena,
            fecha_enviado: fechaRespuestaStr,
            destino: `RESPUESTA de ${nombreUnidad}`,
            instrucciones_adicionales: respuesta.trim()
          });
        }
        
        detalles.secciones_adicionales = seccionesAdicionales;
        
        await pool.query(
          'UPDATE hojas_ruta SET detalles = $1, actualizado_en = now() WHERE id = $2',
          [JSON.stringify(detalles), envio.hoja_id]
        );
        
        console.log(`📤 Respuesta registrada en sección ${seccionLlena} para hoja ${envio.hoja_id}`);
      }
    }
    
    await pool.query(
      `INSERT INTO progreso_hojas_ruta (hoja_ruta_id, ubicacion_actual, accion, responsable_id, notas, respuesta, unidad_destino_id)
       VALUES ($1, 'Respuesta enviada', 'respondido', $2, 'Respuesta de unidad', $3, $4)`,
      [envio.hoja_id, userId, respuesta.trim(), envio.unidad_destino_id]
    );
    
    await pool.query(
      `UPDATE hojas_ruta SET estado = 'respondida', actualizado_en = now() WHERE id = $1`,
      [envio.hoja_id]
    );
    
    return res.status(200).json({ success: true, envio: result.rows[0] });
  } catch (err: any) {
    console.error('Error al enviar respuesta:', err);
    return res.status(500).json({ error: 'Error al enviar respuesta' });
  }
};

export const redirigirEnvio = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { unidad_destino_id, notas, checkboxes } = req.body;
    const userId = req.userId;
    
    if (!unidad_destino_id) {
      return res.status(400).json({ error: 'La unidad destino es requerida' });
    }
    
    const envioActual = await pool.query('SELECT * FROM envios WHERE id = $1', [id]);
    if (envioActual.rows.length === 0) {
      return res.status(404).json({ error: 'Envio no encontrado' });
    }
    
    const envio = envioActual.rows[0];
    const unidadOrigenId = envio.unidad_destino_id;
    
    // Obtener nombre de unidad origen
    const unidadOrigenResult = await pool.query('SELECT nombre FROM unidades WHERE id = $1', [unidadOrigenId]);
    const nombreOrigen = unidadOrigenResult.rows[0]?.nombre || 'Unidad';
    
    await pool.query(
      `UPDATE envios SET estado = 'redirigido', redirigido_a_unidad_id = $1, redirigido_por = $2, 
       fecha_redireccion = now(), actualizado_en = now() WHERE id = $3`,
      [unidad_destino_id, userId, id]
    );
    
    const unidadDestino = await pool.query('SELECT nombre FROM unidades WHERE id = $1', [unidad_destino_id]);
    const nombreDestino = unidadDestino.rows[0]?.nombre || 'Otra unidad';
    
    // Actualizar la siguiente sección disponible con la redirección
    const hojaResult = await pool.query('SELECT detalles FROM hojas_ruta WHERE id = $1', [envio.hoja_id]);
    if (hojaResult.rows.length > 0) {
      let detalles = hojaResult.rows[0].detalles || {};
      const seccionesAdicionales = detalles.secciones_adicionales || [];
      
      // Encontrar la siguiente sección vacía
      let seccionLlena = -1;
      for (let i = 1; i <= 10; i++) {
        const fechaKey = `fecha_enviado_${i}`;
        const seccionEnArray = seccionesAdicionales.find((s: any) => s.seccion === i);
        const tieneFecha = detalles[fechaKey] || seccionEnArray?.fecha_enviado;
        
        if (!tieneFecha) {
          seccionLlena = i;
          break;
        }
      }
      
      if (seccionLlena > 0) {
        // Usar fecha local para evitar desfase de timezone
        const hoy = new Date();
        const fechaRedireccionStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
        const checkboxesArray = checkboxes || [];
        
        detalles[`fecha_enviado_${seccionLlena}`] = fechaRedireccionStr;
        detalles[`destino_${seccionLlena}`] = nombreDestino;
        if (notas) {
          detalles[`instrucciones_${seccionLlena}`] = notas;
        }
        
        const existeEnArray = seccionesAdicionales.findIndex((s: any) => s.seccion === seccionLlena);
        if (existeEnArray >= 0) {
          seccionesAdicionales[existeEnArray] = {
            ...seccionesAdicionales[existeEnArray],
            fecha_enviado: fechaRedireccionStr,
            destino: nombreDestino,
            destinos: checkboxesArray,
            instrucciones_adicionales: notas || seccionesAdicionales[existeEnArray].instrucciones_adicionales,
            redirigido_desde: nombreOrigen
          };
        } else {
          seccionesAdicionales.push({
            seccion: seccionLlena,
            fecha_enviado: fechaRedireccionStr,
            destino: nombreDestino,
            destinos: checkboxesArray,
            instrucciones_adicionales: notas || '',
            redirigido_desde: nombreOrigen
          });
        }
        
        detalles.secciones_adicionales = seccionesAdicionales;
        
        await pool.query(
          'UPDATE hojas_ruta SET detalles = $1, actualizado_en = now() WHERE id = $2',
          [JSON.stringify(detalles), envio.hoja_id]
        );
        
        console.log(`🔀 Redirección registrada en sección ${seccionLlena} para hoja ${envio.hoja_id}`);
      }
    }
    
    const nuevoEnvio = await pool.query(
      `INSERT INTO envios (hoja_id, usuario_id, unidad_destino_id, destinatario_nombre, observaciones, instrucciones, estado, fecha_envio)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'enviado', now()) RETURNING *`,
      [envio.hoja_id, userId, unidad_destino_id, nombreDestino, notas || 'Redirigido desde ' + nombreOrigen, JSON.stringify(checkboxes || [])]
    );
    
    await pool.query(
      `INSERT INTO progreso_hojas_ruta (hoja_ruta_id, unidad_origen_id, unidad_destino_id, ubicacion_actual, accion, responsable_id, notas)
       VALUES ($1, $2, $3, $4, 'redirigido', $5, $6)`,
      [envio.hoja_id, unidadOrigenId, unidad_destino_id, 'Redirigido a ' + nombreDestino, userId, notas || '']
    );
    
    await pool.query(
      `UPDATE hojas_ruta SET unidad_actual_id = $1, ubicacion_actual = $2, estado = 'enviada', actualizado_en = now() WHERE id = $3`,
      [unidad_destino_id, nombreDestino, envio.hoja_id]
    );
    
    return res.status(200).json({ success: true, nuevoEnvio: nuevoEnvio.rows[0] });
  } catch (err: any) {
    console.error('Error al redirigir:', err);
    return res.status(500).json({ error: 'Error al redirigir envio' });
  }
};

export default { 
  crearEnvio, 
  listarEnvios, 
  actualizarEstadoEnvio, 
  obtenerDestinos,
  obtenerEnviosMiUnidad,
  marcarRecibido,
  enviarRespuesta,
  redirigirEnvio,
  enviarAUnidad
};
