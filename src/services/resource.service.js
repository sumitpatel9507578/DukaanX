const { query, transaction } = require('../config/db');

const definitions = {
  categories: { table: 'categories', fields: ['name', 'description'], searchable: ['name', 'description'], global: true },
  products: { table: 'products', fields: ['category_id', 'name', 'brand', 'barcode', 'sku', 'unit', 'purchase_price', 'selling_price', 'minimum_stock', 'image', 'description', 'is_active'], searchable: ['name', 'brand', 'barcode', 'sku'] },
  suppliers: { table: 'suppliers', fields: ['name', 'phone', 'email', 'address'], searchable: ['name', 'phone', 'email'] },
  customers: { table: 'customers', fields: ['name', 'phone', 'email', 'address'], searchable: ['name', 'phone', 'email'] },
  stores: { table: 'stores', fields: ['name', 'phone', 'email', 'address', 'image'], searchable: ['name', 'phone', 'email'] },
};

function definition(resource) {
  const result = definitions[resource];
  if (!result) throw new Error(`Unknown resource: ${resource}`);
  return result;
}

function pagination(queryParams) {
  const page = Math.max(1, Number.parseInt(queryParams.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(queryParams.limit, 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

async function list(resource, storeId, params = {}) {
  const config = definition(resource);
  const { page, limit, offset } = pagination(params);
  const where = [];
  const values = [];
  if (resource === 'stores') {
    where.push('s.is_active = 1 AND s.id IN (SELECT store_id FROM store_members WHERE user_id = ?)');
    values.push(params.userId);
  } else if (config.global) {
    where.push('(store_id = ? OR store_id IS NULL)');
    values.push(storeId);
  } else {
    where.push('store_id = ?');
    values.push(storeId);
  }
  const active = params.is_active ?? params.active;
  if (active !== undefined) {
    where.push('is_active = ?');
    values.push(active === 'true' || active === '1' ? 1 : 0);
  }
  if (params.category_id && resource === 'products') {
    where.push('category_id = ?');
    values.push(params.category_id);
  }
  if (params.barcode && resource === 'products') {
    where.push('barcode = ?');
    values.push(params.barcode);
  }
  if (params.search && config.searchable.length) {
    where.push(`(${config.searchable.map((column) => `${column} LIKE ?`).join(' OR ')})`);
    const needle = `%${String(params.search).replace(/[\\%_]/g, '\\$&')}%`;
    values.push(...config.searchable.map(() => needle));
  }
  const clause = where.join(' AND ');
  const countRows = await query(`SELECT COUNT(*) AS total FROM ${config.table} ${resource === 'stores' ? 's' : ''} WHERE ${clause}`, values);
  const rows = await query(
    `SELECT * FROM ${config.table} ${resource === 'stores' ? 's' : ''} WHERE ${clause} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...values, limit, offset],
  );
  return { items: rows, pagination: { page, limit, total: countRows[0].total, pages: Math.ceil(countRows[0].total / limit) } };
}

async function get(resource, storeId, id, userId) {
  const config = definition(resource);
  if (resource === 'stores') {
    const rows = await query(
      'SELECT s.* FROM stores s JOIN store_members sm ON sm.store_id = s.id WHERE s.id = ? AND sm.user_id = ? AND s.is_active = 1',
      [id, userId],
    );
    return rows[0] || null;
  }
  const scope = config.global ? '(store_id = ? OR store_id IS NULL)' : 'store_id = ?';
  const rows = await query(`SELECT * FROM ${config.table} WHERE id = ? AND ${scope}`, config.global ? [id, storeId] : [id, storeId]);
  return rows[0] || null;
}

async function create(resource, storeId, userId, data) {
  const config = definition(resource);
  await validate(resource, data, storeId);
  const fields = config.fields.filter((field) => data[field] !== undefined);
  const columns = resource === 'stores' ? ['owner_user_id', ...fields] : ['store_id', ...fields];
  const values = resource === 'stores' ? [userId, ...fields.map((field) => data[field])] : [storeId, ...fields.map((field) => data[field])];
  if (resource === 'stores') {
    return transaction(async (connection) => {
      const [result] = await connection.execute(
        `INSERT INTO ${config.table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
        values,
      );
      await connection.execute('INSERT INTO store_members (store_id, user_id, role) VALUES (?, ?, ?)', [result.insertId, userId, 'owner']);
      const [rows] = await connection.execute('SELECT * FROM stores WHERE id = ?', [result.insertId]);
      return rows[0];
    });
  }
  const result = await query(
    `INSERT INTO ${config.table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    values,
  );
  return get(resource, storeId, result.insertId, userId);
}

async function update(resource, storeId, userId, id, data) {
  const config = definition(resource);
  await validate(resource, data, storeId, true);
  const fields = config.fields.filter((field) => data[field] !== undefined);
  if (!fields.length) return get(resource, storeId, id, userId);
  const scope = resource === 'stores'
    ? 'id = ? AND id IN (SELECT store_id FROM store_members WHERE user_id = ? AND role IN (\'owner\', \'manager\'))'
    : `id = ? AND ${config.global ? 'store_id = ?' : 'store_id = ?'}`;
  const scopeValues = resource === 'stores' ? [id, userId] : [id, storeId];
  await query(
    `UPDATE ${config.table} SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE ${scope}`,
    [...fields.map((field) => data[field]), ...scopeValues],
  );
  return get(resource, storeId, id, userId);
}

async function deactivate(resource, storeId, userId, id) {
  const config = definition(resource);
  const scope = resource === 'stores'
    ? 'id = ? AND owner_user_id = ? AND is_active = 1'
    : `id = ? AND ${config.global ? 'store_id = ?' : 'store_id = ?'}`;
  const values = resource === 'stores' ? [id, userId] : [id, storeId];
  const result = await query(`UPDATE ${config.table} SET is_active = 0 WHERE ${scope}`, values);
  return result.affectedRows > 0;
}

function validate(resource, data, storeId, partial = false) {
  const reject = (message) => { throw Object.assign(new Error(message), { status: 400 }); };
  if (!data || typeof data !== 'object' || Array.isArray(data)) reject('Request body must be an object');
  const maxName = resource === 'categories' ? 120 : resource === 'products' ? 180 : 160;
  if (!partial && (!data.name || typeof data.name !== 'string' || !data.name.trim())) reject('Name is required');
  if (partial && !definition(resource).fields.some((field) => data[field] !== undefined)) reject('At least one updatable field is required');
  if (data.name !== undefined && (typeof data.name !== 'string' || !data.name.trim() || data.name.length > maxName)) reject(`Name must be a non-empty string of at most ${maxName} characters`);
  const textLimits = { phone: 32, email: 190, address: 500, image: 1000, brand: 120, barcode: 100, sku: 100, unit: 32, description: resource === 'categories' ? 500 : 65535 };
  for (const [field, max] of Object.entries(textLimits)) {
    if (data[field] !== undefined && data[field] !== null
      && (typeof data[field] !== 'string' || data[field].length > max)) reject(`${field} must be a string of at most ${max} characters`);
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) reject('email must be a valid email address');
  if (data.image !== undefined && data.image !== null) {
    let imageUrl;
    try { imageUrl = new URL(data.image); } catch { reject('image must be an absolute URL'); }
    if (!['http:', 'https:'].includes(imageUrl.protocol)) reject('image must use HTTP or HTTPS');
  }
  if (data.is_active !== undefined && ![true, false, 0, 1, '0', '1'].includes(data.is_active)) reject('is_active must be a boolean');
  if (resource === 'products') {
    for (const field of ['purchase_price', 'selling_price']) {
      if (data[field] !== undefined && (!Number.isFinite(Number(data[field])) || Number(data[field]) < 0
        || Number(data[field]) > 999999999999.99
        || Math.abs(Number(data[field]) * 100 - Math.round(Number(data[field]) * 100)) > 1e-7)) reject(`${field} must be a non-negative price with at most 2 decimals`);
    }
    if (data.minimum_stock !== undefined && (!Number.isFinite(Number(data.minimum_stock)) || Number(data.minimum_stock) < 0
      || Number(data.minimum_stock) > 99999999999.999
      || Math.abs(Number(data.minimum_stock) * 1000 - Math.round(Number(data.minimum_stock) * 1000)) > 1e-7)) {
      reject('minimum_stock must be non-negative with at most 3 decimal places');
    }
    if (data.category_id !== undefined && data.category_id !== null) {
      return query('SELECT id FROM categories WHERE id = ? AND (store_id = ? OR store_id IS NULL) AND is_active = 1', [data.category_id, storeId]).then((rows) => {
        if (!rows.length) reject('Category not found in this store');
      });
    }
  }
  return undefined;
}

module.exports = { definitions, pagination, list, get, create, update, deactivate };
