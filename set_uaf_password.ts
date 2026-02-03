import pool from './src/config/database';
import bcryptjs from 'bcryptjs';

async function main() {
  try {
    const salt = await bcryptjs.genSalt(10);
    const hash = await bcryptjs.hash('uaf123', salt);
    await pool.query('UPDATE usuarios SET password_hash = $1 WHERE username = $2', [hash, 'uaf']);
    console.log('✅ Password actualizada para uaf: uaf123');
  } catch(e) {
    console.error('Error:', e);
  } finally {
    process.exit();
  }
}

main();
