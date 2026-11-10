const { query, transaction } = require('../config/db');

async function findExpiring(storeId, days = 30) {
  const range = Math.min(365, Math.max(0, Number(days) || 30));
  return query(
    `SELECT b.*, p.name AS product_name FROM stock_batches b
     JOIN products p ON p.id = b.product_id
     WHERE b.store_id = ? AND b.quantity > 0
       AND b.expiry_date BETWEEN UTC_DATE() AND DATE_ADD(UTC_DATE(), INTERVAL ? DAY)
     ORDER BY b.expiry_date, b.id`,
    [storeId, range],
  );
}

async function findExpired(storeId) {
  return query(
    `SELECT b.*, p.name AS product_name FROM stock_batches b
     JOIN products p ON p.id = b.product_id
     WHERE b.store_id = ? AND b.quantity > 0 AND b.expiry_date < UTC_DATE()
     ORDER BY b.expiry_date, b.id`,
    [storeId],
  );
}

async function processExpiredStock() {
  const candidates = await query(
    'SELECT id, store_id FROM stock_batches WHERE quantity > 0 AND expiry_date < UTC_DATE() ORDER BY store_id, id',
  );
  let processed = 0;
  for (const candidate of candidates) {
    const changed = await transaction(async (connection) => {
      const [rows] = await connection.execute(
        `SELECT b.id, b.store_id, b.product_id, b.quantity, s.owner_user_id
         FROM stock_batches b JOIN stores s ON s.id = b.store_id
         WHERE b.id = ? AND b.quantity > 0 AND b.expiry_date < UTC_DATE()
         FOR UPDATE`,
        [candidate.id],
      );
      if (!rows.length) return false;
      const batch = rows[0];
      await connection.execute('UPDATE stock_batches SET quantity = 0 WHERE id = ?', [batch.id]);
      await connection.execute(
        `INSERT INTO stock_transactions
          (store_id, product_id, batch_id, type, quantity_change, reason, created_by)
         VALUES (?, ?, ?, 'expiry', ?, 'expired', ?)`,
        [batch.store_id, batch.product_id, batch.id, -Number(batch.quantity), batch.owner_user_id],
      );
      await connection.execute(
        `INSERT INTO notifications (store_id, type, title, message)
         VALUES (?, 'expiry', 'Expired stock removed', ?)`,
        [batch.store_id, `Batch ${batch.id} expired; removed ${batch.quantity} units from inventory.`],
      );
      return true;
    });
    if (changed) processed += 1;
  }
  return processed;
}

module.exports = { findExpiring, findExpired, processExpiredStock };
