const { loadEnv } = require('./config/env');
const { getPool, getConnectionTarget } = require('./config/db');
const { processExpiredStock } = require('./services/expiry.service');

function getErrorCodes(error) {
  const errors = Array.isArray(error?.errors) ? error.errors : [error];
  return [...new Set(errors.map((item) => item?.code).filter(Boolean))];
}

function databaseStartupError(error, action, guidance) {
  const { host, port } = getConnectionTarget();
  const codes = getErrorCodes(error);
  const reason = codes.length ? ` (${codes.join(', ')})` : '';
  return new Error(`${action} at ${host}:${port}${reason}. ${guidance}`);
}

async function verifyDatabaseConnection() {
  try {
    await getPool().query('SELECT 1');
  } catch (error) {
    throw databaseStartupError(
      error,
      'MySQL connection failed',
      'Check the configured DB_HOST, DB_PORT, and database availability.',
    );
  }
}

async function start() {
  const config = loadEnv();
  await verifyDatabaseConnection();
  try {
    await processExpiredStock();
  } catch (error) {
    throw databaseStartupError(
      error,
      'Database startup initialization failed',
      'Check database availability and run npm run migrate if the schema is missing.',
    );
  }
  const app = require('./app');
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`DukaanX API listening on port ${config.port}`);
  });
  const expiryTimer = setInterval(() => {
    processExpiredStock().catch((error) => console.error('Scheduled expiry processing failed:', error.message));
  }, 24 * 60 * 60 * 1000);
  expiryTimer.unref();
  const shutdown = () => server.close(async () => {
    clearInterval(expiryTimer);
    await getPool().end();
    process.exit(0);
  });
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((error) => {
  console.error('Failed to start DukaanX API:', error.message);
  process.exitCode = 1;
});
