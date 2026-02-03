import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';
import logger from '../utils/logger';

dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';

// Configurar pool de conexiones (compatible con Railway y variables estándar)
const poolConfig: PoolConfig = {
  host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
  port: parseInt(process.env.DB_PORT || process.env.PGPORT || '5432', 10),
  database: process.env.DB_NAME || process.env.PGDATABASE || process.env.POSTGRES_DB,
  user: process.env.DB_USER || process.env.PGUSER || process.env.POSTGRES_USER,
  password: process.env.DB_PASSWORD || process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD,
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT || '2000', 10),
};

// Habilitar SSL en producción
if (NODE_ENV === 'production') {
  poolConfig.ssl = {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    ca: process.env.DB_SSL_CA ? Buffer.from(process.env.DB_SSL_CA, 'base64').toString() : undefined,
    cert: process.env.DB_SSL_CERT ? Buffer.from(process.env.DB_SSL_CERT, 'base64').toString() : undefined,
    key: process.env.DB_SSL_KEY ? Buffer.from(process.env.DB_SSL_KEY, 'base64').toString() : undefined,
  };
  logger.info('SSL habilitado para conexión PostgreSQL');
}

const pool = new Pool(poolConfig);

// Event listeners
pool.on('connect', () => {
  logger.debug('Conexión establecida con PostgreSQL');
});

pool.on('error', (err: Error) => {
  logger.error({
    message: 'Error no esperado en pool de conexiones PostgreSQL',
    error: err.message,
    stack: err.stack
  });
});

pool.on('remove', () => {
  logger.debug('Cliente removido del pool');
});

// Validar conexión al inicializar
pool.query('SELECT NOW()', (err, result) => {
  if (err) {
    logger.error({
      message: 'Error conectando a PostgreSQL',
      error: err.message,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME
    });
  } else {
    logger.info({
      message: 'Conexión exitosa a PostgreSQL',
      database: process.env.DB_NAME,
      host: process.env.DB_HOST,
      timestamp: result.rows[0].now
    });
  }
});

export default pool;