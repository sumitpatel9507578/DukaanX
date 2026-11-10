require('../src/config/env').loadEnv();
const fs = require('node:fs/promises');
const path = require('node:path');
const { getPool } = require('../src/config/db');

async function migrate() {
  const pool = getPool();
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name VARCHAR(255) NOT NULL PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);
  const directory = path.join(__dirname, 'migrations');
  const files = (await fs.readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    const [existing] = await pool.execute('SELECT name FROM schema_migrations WHERE name = ?', [file]);
    if (existing.length) continue;
    const sql = await fs.readFile(path.join(directory, file), 'utf8');
    await pool.query(sql);
    await pool.execute('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
    console.log(`Applied ${file}`);
  }
  await pool.end();
}

migrate().catch((error) => {
  console.error('Database migration failed:', error.message);
  process.exitCode = 1;
});
