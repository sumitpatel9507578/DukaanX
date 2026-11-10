const mysql = require('mysql2/promise');

let pool;

function getConnectionTarget() {
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
  };
}

function getPool() {
  if (!pool) {
    const target = getConnectionTarget();
    pool = mysql.createPool({
      ...target,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
      decimalNumbers: true,
      dateStrings: true,
      timezone: 'Z',
    });
  }
  return pool;
}

async function query(sql, values = []) {
  const [rows] = await getPool().execute(sql, values);
  return rows;
}

async function transaction(work) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { getPool, getConnectionTarget, query, transaction };
