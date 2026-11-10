const { loadEnv } = require('./config/env');
const { getPool } = require('./config/db');
const { processExpiredStock } = require('./services/expiry.service');

async function start() {
  const config = loadEnv();
  await getPool().query('SELECT 1');
  await processExpiredStock();
  const app = require('./app');
  const server = app.listen(config.port, () => {
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
  console.error('Failed to start DukaanX API:', error);
  process.exitCode = 1;
});
