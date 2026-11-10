const { query } = require('../config/db');

async function getBalance(storeId, partyId, type) {
  const customer = type === 'customer';
  if (!customer && type !== 'supplier') throw new Error('Party type must be customer or supplier');
  const partyTable = customer ? 'customers' : 'suppliers';
  const ledgerTable = customer ? 'customer_transactions' : 'supplier_transactions';
  const partyColumn = customer ? 'customer_id' : 'supplier_id';
  const rows = await query(
    `SELECT p.id, p.opening_balance + COALESCE(SUM(t.amount), 0) AS balance
     FROM ${partyTable} p LEFT JOIN ${ledgerTable} t
       ON t.${partyColumn} = p.id AND t.store_id = p.store_id
     WHERE p.id = ? AND p.store_id = ? GROUP BY p.id`,
    [partyId, storeId],
  );
  return rows[0] || null;
}

module.exports = { getBalance };
