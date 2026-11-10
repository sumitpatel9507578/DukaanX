const { query } = require('../config/db');

async function createNotification(storeId, userId, type, title, message) {
  const result = await query(
    'INSERT INTO notifications (store_id, user_id, type, title, message) VALUES (?, ?, ?, ?, ?)',
    [storeId, userId || null, type, title, message],
  );
  return result.insertId;
}

module.exports = { createNotification };
