import pool from './src/config/database';
import bcryptjs from 'bcryptjs';

async function main() {
  try {
    // Resetear contraseña de uaf
    const salt1 = await bcryptjs.genSalt(10);
    const hash1 = await bcryptjs.hash('uaf', salt1);
    await pool.query('UPDATE usuarios SET password_hash = $1 WHERE username = $2', [hash1, 'uaf']);
    console.log('✅ Usuario: uaf | Contraseña: uaf');

    // Resetear contraseña de rrhh
    const salt2 = await bcryptjs.genSalt(10);
    const hash2 = await bcryptjs.hash('rrhh', salt2);
    await pool.query('UPDATE usuarios SET password_hash = $1 WHERE username = $2', [hash2, 'rrhh']);
    console.log('✅ Usuario: rrhh | Contraseña: rrhh');

    console.log('\n=== CREDENCIALES ACTUALIZADAS ===');
    console.log('Puedes usar:');
    console.log('  - Usuario: uaf  | Contraseña: uaf');
    console.log('  - Usuario: rrhh | Contraseña: rrhh');
    console.log('  - Usuario: UAF  | Contraseña: uaf (case-insensitive)');
    
  } catch(e) {
    console.error('Error:', e);
  } finally {
    process.exit();
  }
}

main();
