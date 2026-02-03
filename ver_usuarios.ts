import pool from './src/config/database';

async function main() {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.nombre_completo, u.activo, 
             r.nombre as rol, un.nombre as unidad
      FROM usuarios u 
      LEFT JOIN roles r ON u.rol_id = r.id 
      LEFT JOIN unidades un ON u.unidad_id = un.id 
      WHERE u.eliminado_en IS NULL
    `);
    
    console.log('\n=== USUARIOS EN LA BASE DE DATOS ===\n');
    result.rows.forEach(u => {
      console.log(`ID: ${u.id}`);
      console.log(`  Username: ${u.username}`);
      console.log(`  Nombre: ${u.nombre_completo}`);
      console.log(`  Rol: ${u.rol}`);
      console.log(`  Unidad: ${u.unidad || '(ninguna)'}`);
      console.log(`  Activo: ${u.activo}`);
      console.log('---');
    });
    
  } catch(e) {
    console.error('Error:', e);
  } finally {
    process.exit();
  }
}

main();
