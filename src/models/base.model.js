const { query } = require('../config/db');

const tables = new Set([
  'users', 'stores', 'categories', 'products', 'suppliers', 'customers',
  'purchases', 'purchase_items', 'sales', 'sale_items', 'stock_batches',
  'stock_transactions', 'customer_transactions', 'supplier_transactions',
  'payments', 'notifications', 'activity_logs',
]);

function table(name) {
  if (!tables.has(name)) throw new Error('Unsupported model table');
  return name;
}

function findById(name, id, storeId) {
  const resource = table(name);
  return storeId === undefined
    ? query(`SELECT * FROM ${resource} WHERE id = ?`, [id]).then((rows) => rows[0] || null)
    : query(`SELECT * FROM ${resource} WHERE id = ? AND store_id = ?`, [id, storeId]).then((rows) => rows[0] || null);
}

function create(name, fields) {
  const resource = table(name);
  const names = Object.keys(fields);
  if (!names.length || names.some((key) => !/^[a-z_]+$/.test(key))) throw new Error('Invalid model fields');
  return query(
    `INSERT INTO ${resource} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`,
    names.map((key) => fields[key]),
  );
}

function update(name, id, storeId, fields) {
  const resource = table(name);
  const names = Object.keys(fields);
  if (!names.length || names.some((key) => !/^[a-z_]+$/.test(key))) throw new Error('Invalid model fields');
  const scope = storeId === undefined ? 'id = ?' : 'id = ? AND store_id = ?';
  return query(
    `UPDATE ${resource} SET ${names.map((key) => `${key} = ?`).join(', ')} WHERE ${scope}`,
    [...names.map((key) => fields[key]), id, ...(storeId === undefined ? [] : [storeId])],
  );
}

function forTable(name) {
  table(name);
  return {
    findById: (id, storeId) => findById(name, id, storeId),
    create: (fields) => create(name, fields),
    update: (id, storeId, fields) => update(name, id, storeId, fields),
  };
}

module.exports = { findById, create, update, forTable };
