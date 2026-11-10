const { query, transaction } = require('../config/db');
const commerce = require('../services/commerce.service');
const { success, fail } = require('../utils/response');
const { pagination } = require('../utils/pagination');
const { isValidDate } = require('../utils/date');
const { wrap } = require('./api.controller');

const send = (res, message, data, status) => success(res, message, data, status);
const invalid = (message) => Object.assign(new Error(message), { status: 400 });
const purchases = {
  create: wrap(async (req, res) => send(res, 'Purchase created', await commerce.createPurchase(req.body, req.store.id, req.user.id), 201)),
  list: wrap(async (req, res) => {
    const { page, limit, offset } = pagination(req.query);
    const filters = ['p.store_id = ?'];
    const values = [req.store.id];
    if (req.query.supplier_id) { filters.push('p.supplier_id = ?'); values.push(req.query.supplier_id); }
    if (req.query.from) { if (!isValidDate(req.query.from)) throw invalid('from must be YYYY-MM-DD'); filters.push('p.purchased_at >= ?'); values.push(req.query.from); }
    if (req.query.to) { if (!isValidDate(req.query.to)) throw invalid('to must be YYYY-MM-DD'); filters.push('p.purchased_at < DATE_ADD(?, INTERVAL 1 DAY)'); values.push(req.query.to); }
    const where = filters.join(' AND ');
    const [count] = await query(`SELECT COUNT(*) AS total FROM purchases p WHERE ${where}`, values);
    const items = await query(`SELECT p.*, s.name AS supplier_name FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE ${where} ORDER BY p.id DESC LIMIT ? OFFSET ?`, [...values, limit, offset]);
    return send(res, 'Purchases loaded', { items, pagination: { page, limit, total: count.total, pages: Math.ceil(count.total / limit) } });
  }),
  get: wrap(async (req, res) => {
    const rows = await query('SELECT * FROM purchases WHERE id = ? AND store_id = ?', [req.params.id, req.store.id]);
    if (!rows.length) return fail(res, 'Purchase not found', 404);
    const items = await query('SELECT pi.*, p.name AS product_name, sb.batch_number, sb.expiry_date FROM purchase_items pi JOIN products p ON p.id = pi.product_id LEFT JOIN stock_batches sb ON sb.id = pi.batch_id WHERE pi.purchase_id = ?', [req.params.id]);
    return send(res, 'Purchase details', { ...rows[0], items });
  }),
  update: wrap(async (req, res) => send(res, 'Purchase updated', await commerce.createPurchase(req.body, req.store.id, req.user.id, Number(req.params.id)))),
  delete: wrap(async (req, res) => send(res, 'Purchase cancelled', await commerce.cancelPurchase(Number(req.params.id), req.store.id, req.user.id))),
};

const sales = {
  create: wrap(async (req, res) => send(res, 'Sale created', await commerce.createSale(req.body, req.store.id, req.user.id), 201)),
  list: wrap(async (req, res) => {
    const { page, limit } = pagination(req.query);
    const filters = ['s.store_id = ?'];
    const values = [req.store.id];
    if (req.query.customer_id) { filters.push('s.customer_id = ?'); values.push(req.query.customer_id); }
    if (req.query.from) { if (!isValidDate(req.query.from)) throw invalid('from must be YYYY-MM-DD'); filters.push('s.sold_at >= ?'); values.push(req.query.from); }
    if (req.query.to) { if (!isValidDate(req.query.to)) throw invalid('to must be YYYY-MM-DD'); filters.push('s.sold_at < DATE_ADD(?, INTERVAL 1 DAY)'); values.push(req.query.to); }
    const where = filters.join(' AND ');
    const [count] = await query(`SELECT COUNT(*) AS total FROM sales s WHERE ${where}`, values);
    const items = await query(`SELECT s.*, c.name AS customer_name FROM sales s LEFT JOIN customers c ON c.id = s.customer_id WHERE ${where} ORDER BY s.id DESC LIMIT ? OFFSET ?`, [...values, limit, (page - 1) * limit]);
    return send(res, 'Sales loaded', { items, pagination: { page, limit, total: count.total, pages: Math.ceil(count.total / limit) } });
  }),
  get: wrap(async (req, res) => {
    const rows = await query('SELECT * FROM sales WHERE id = ? AND store_id = ?', [req.params.id, req.store.id]);
    if (!rows.length) return fail(res, 'Sale not found', 404);
    const items = await query('SELECT si.*, p.name AS product_name, sb.batch_number FROM sale_items si JOIN products p ON p.id = si.product_id JOIN stock_batches sb ON sb.id = si.batch_id WHERE si.sale_id = ?', [req.params.id]);
    return send(res, 'Sale details', { ...rows[0], items });
  }),
  update: wrap(async (req, res) => send(res, 'Sale updated', await commerce.createSale(req.body, req.store.id, req.user.id, Number(req.params.id)))),
  return: wrap(async (req, res) => send(res, 'Sale return processed', await commerce.returnSale(Number(req.params.id), req.store.id, req.user.id, req.body))),
};

const inventory = {
  list: wrap(async (req, res) => {
    const { page, limit } = pagination(req.query);
    const filters = ['p.store_id = ?', 'p.is_active = 1'];
    const values = [req.store.id];
    if (req.query.category_id) { filters.push('p.category_id = ?'); values.push(req.query.category_id); }
    if (req.query.search) { filters.push('(p.name LIKE ? OR p.barcode LIKE ? OR p.sku LIKE ?)'); values.push(...Array(3).fill(`%${req.query.search}%`)); }
    if (req.query.low_stock === 'true' || req.path.endsWith('/low-stock')) filters.push('COALESCE(st.quantity, 0) <= p.minimum_stock');
    const where = filters.join(' AND ');
    const join = ' FROM products p LEFT JOIN (SELECT product_id, SUM(quantity) AS quantity FROM stock_batches WHERE store_id = ? GROUP BY product_id) st ON st.product_id = p.id';
    const countRows = await query(`SELECT COUNT(*) AS total ${join} WHERE ${where}`, [req.store.id, ...values]);
    const items = await query(`SELECT p.*, COALESCE(st.quantity, 0) AS stock_quantity ${join} WHERE ${where} ORDER BY p.name LIMIT ? OFFSET ?`, [req.store.id, ...values, limit, (page - 1) * limit]);
    return send(res, 'Inventory loaded', { items, pagination: { page, limit, total: countRows[0].total, pages: Math.ceil(countRows[0].total / limit) } });
  }),
  product: wrap(async (req, res) => {
    const products = await query('SELECT * FROM products WHERE id = ? AND store_id = ?', [req.params.productId, req.store.id]);
    if (!products.length) return fail(res, 'Product not found', 404);
    const batches = await query('SELECT * FROM stock_batches WHERE product_id = ? AND store_id = ? ORDER BY expiry_date IS NULL, expiry_date, id', [req.params.productId, req.store.id]);
    const total = batches.reduce((sum, batch) => sum + Number(batch.quantity), 0);
    return send(res, 'Product inventory loaded', { product: products[0], quantity: total, batches });
  }),
  expiring: (expiredOnly = false) => wrap(async (req, res) => {
    const parsedDays = req.query.days === undefined ? 30 : Number(req.query.days);
    if (!expiredOnly && (!Number.isInteger(parsedDays) || parsedDays < 0 || parsedDays > 365)) {
      return fail(res, 'days must be an integer between 0 and 365', 400);
    }
    const days = parsedDays;
    const { page, limit } = pagination(req.query);
    const values = expiredOnly ? [req.store.id, req.store.id] : [req.store.id, days];
    const sql = expiredOnly
      ? `SELECT 'on_hand' AS record_type, sb.id, sb.product_id, p.name AS product_name, sb.quantity,
           sb.expiry_date AS occurred_on
         FROM stock_batches sb JOIN products p ON p.id = sb.product_id
         WHERE sb.store_id = ? AND sb.quantity > 0 AND sb.expiry_date < UTC_DATE()
         UNION ALL
         SELECT 'removed' AS record_type, st.batch_id AS id, st.product_id, p.name, ABS(st.quantity_change),
           DATE(st.created_at) AS occurred_on
         FROM stock_transactions st JOIN products p ON p.id = st.product_id
         WHERE st.store_id = ? AND st.type = 'expiry'`
      : `SELECT sb.*, p.name AS product_name FROM stock_batches sb JOIN products p ON p.id = sb.product_id
         WHERE sb.store_id = ? AND sb.quantity > 0
         AND sb.expiry_date BETWEEN UTC_DATE() AND DATE_ADD(UTC_DATE(), INTERVAL ? DAY)`;
    const [count] = await query(`SELECT COUNT(*) AS total FROM (${sql}) expiring_rows`, values);
    const items = await query(`SELECT * FROM (${sql}) expiring_rows ORDER BY ${expiredOnly ? 'occurred_on DESC' : 'expiry_date'} LIMIT ? OFFSET ?`, [...values, limit, (page - 1) * limit]);
    return send(res, expiredOnly ? 'Expired stock loaded' : 'Expiring stock loaded', {
      items,
      pagination: { page, limit, total: count[0].total, pages: Math.ceil(count[0].total / limit) },
    });
  }),
  adjust: wrap(async (req, res) => {
    const allowed = ['damaged', 'lost', 'found', 'correction', 'wastage', 'other'];
    const { product_id: productId, quantity_change: change, reason, batch_number: batchNumber, expiry_date: expiryDate } = req.body;
    if (!allowed.includes(reason) || !Number.isFinite(Number(change)) || Number(change) === 0) return fail(res, 'A non-zero quantity_change and valid reason are required', 400);
    const quantity = Math.abs(Number(change));
    const productRows = await query('SELECT id, purchase_price FROM products WHERE id = ? AND store_id = ? AND is_active = 1', [productId, req.store.id]);
    if (!productRows.length) return fail(res, 'Product not found', 404);
    const result = await transaction(async (connection) => {
      if (Number(change) > 0) {
        const [batch] = await connection.execute('INSERT INTO stock_batches (store_id, product_id, batch_number, quantity, purchase_price, expiry_date) VALUES (?, ?, ?, ?, ?, ?)',
          [req.store.id, productId, batchNumber || null, quantity, Number(req.body.purchase_price ?? productRows[0].purchase_price), expiryDate || null]);
        await connection.execute('INSERT INTO stock_transactions (store_id, product_id, batch_id, type, quantity_change, reason, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [req.store.id, productId, batch.insertId, 'adjustment', quantity, reason, req.user.id]);
        return { batch_id: batch.insertId, quantity_change: quantity };
      }
      const [batches] = await connection.execute('SELECT id, quantity FROM stock_batches WHERE store_id = ? AND product_id = ? AND quantity > 0 ORDER BY expiry_date IS NULL, expiry_date, id FOR UPDATE', [req.store.id, productId]);
      const available = batches.reduce((sum, batch) => sum + Number(batch.quantity), 0);
      if (available < quantity) throw Object.assign(new Error('Adjustment exceeds available stock'), { status: 409 });
      let remaining = quantity;
      for (const batch of batches) {
        if (!remaining) break;
        const take = Math.min(remaining, Number(batch.quantity));
        await connection.execute('UPDATE stock_batches SET quantity = quantity - ? WHERE id = ?', [take, batch.id]);
        await connection.execute('INSERT INTO stock_transactions (store_id, product_id, batch_id, type, quantity_change, reason, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [req.store.id, productId, batch.id, 'adjustment', -take, reason, req.user.id]);
        remaining -= take;
      }
      return { quantity_change: -quantity };
    });
    return send(res, 'Stock adjusted', result, 201);
  }),
  transactions: wrap(async (req, res) => {
    const { page, limit } = pagination(req.query);
    const filters = ['store_id = ?'];
    const values = [req.store.id];
    for (const key of ['product_id', 'type', 'batch_id']) {
      if (req.query[key]) { filters.push(`${key} = ?`); values.push(req.query[key]); }
    }
    if (req.query.from) { if (!isValidDate(req.query.from)) throw invalid('from must be YYYY-MM-DD'); filters.push('created_at >= ?'); values.push(req.query.from); }
    if (req.query.to) { if (!isValidDate(req.query.to)) throw invalid('to must be YYYY-MM-DD'); filters.push('created_at < DATE_ADD(?, INTERVAL 1 DAY)'); values.push(req.query.to); }
    const where = filters.join(' AND ');
    const [count] = await query(`SELECT COUNT(*) AS total FROM stock_transactions WHERE ${where}`, values);
    const items = await query(`SELECT * FROM stock_transactions WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...values, limit, (page - 1) * limit]);
    return send(res, 'Stock transactions loaded', { items, pagination: { page, limit, total: count[0].total, pages: Math.ceil(count[0].total / limit) } });
  }),
};

const payments = {
  create: wrap(async (req, res) => {
    const { party_type: type, party_id: partyId, amount: rawAmount, method, direction } = req.body;
    const amount = Number(rawAmount);
    const methods = ['cash', 'upi', 'card', 'bank_transfer', 'credit', 'mixed'];
    const adjustment = req.body.transaction_type === 'adjustment';
    const adjustmentDirection = req.body.adjustment_direction;
    const validDirection = (type === 'customer' && direction === 'received')
      || (type === 'supplier' && ['paid', 'received'].includes(direction));
    if (!['customer', 'supplier'].includes(type) || !Number.isFinite(amount) || amount <= 0
      || (adjustment ? !['credit', 'debit'].includes(adjustmentDirection) : !methods.includes(method) || !validDirection)) {
      return fail(res, 'Invalid party, amount, method, direction, or adjustment', 400);
    }
    const table = type === 'customer' ? 'customers' : 'suppliers';
    const ledgerTable = type === 'customer' ? 'customer_transactions' : 'supplier_transactions';
    const partyColumn = type === 'customer' ? 'customer_id' : 'supplier_id';
    const data = await transaction(async (connection) => {
      const [party] = await connection.execute(`SELECT id FROM ${table} WHERE id = ? AND store_id = ? AND is_active = 1 FOR UPDATE`, [partyId, req.store.id]);
      if (!party.length) throw Object.assign(new Error(`${type} not found`), { status: 404 });
      let paymentId = null;
      if (!adjustment) {
        const [payment] = await connection.execute(
          'INSERT INTO payments (store_id, party_type, party_id, amount, method, direction, reference, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [req.store.id, type, partyId, amount, method, direction, req.body.reference || null, req.body.notes || null, req.user.id],
        );
        paymentId = payment.insertId;
      }
      const ledgerAmount = adjustment
        ? amount * (adjustmentDirection === 'debit' ? 1 : -1)
        : (type === 'supplier' && direction === 'received' ? amount : -amount);
      await connection.execute(
        `INSERT INTO ${ledgerTable} (store_id, ${partyColumn}, type, amount, reference_type, reference_id, description, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.store.id, partyId, adjustment ? 'adjustment' : 'payment', ledgerAmount, adjustment ? 'adjustment' : 'payment', paymentId, req.body.notes || req.body.reason || (adjustment ? 'Khata adjustment' : 'Payment'), req.user.id],
      );
      const [result] = await connection.execute(
        `SELECT c.opening_balance + COALESCE(SUM(t.amount), 0) AS balance FROM ${table} c LEFT JOIN ${ledgerTable} t ON t.${partyColumn} = c.id AND t.store_id = c.store_id WHERE c.id = ? AND c.store_id = ? GROUP BY c.id`,
        [partyId, req.store.id],
      );
      return { payment_id: paymentId, transaction_type: adjustment ? 'adjustment' : 'payment', balance: result[0].balance };
    });
    return send(res, 'Payment recorded', data, 201);
  }),
  list: wrap(async (req, res) => {
    const { page, limit } = pagination(req.query);
    const filters = ['store_id = ?']; const values = [req.store.id];
    if (req.query.party_type) { filters.push('party_type = ?'); values.push(req.query.party_type); }
    if (req.query.party_id) { filters.push('party_id = ?'); values.push(req.query.party_id); }
    const where = filters.join(' AND ');
    const [count] = await query(`SELECT COUNT(*) AS total FROM payments WHERE ${where}`, values);
    const items = await query(`SELECT * FROM payments WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...values, limit, (page - 1) * limit]);
    return send(res, 'Payments loaded', { items, pagination: { page, limit, total: count[0].total, pages: Math.ceil(count[0].total / limit) } });
  }),
};

async function balance(req, res, type) {
  const customer = type === 'customer';
  const table = customer ? 'customers' : 'suppliers';
  const ledger = customer ? 'customer_transactions' : 'supplier_transactions';
  const column = customer ? 'customer_id' : 'supplier_id';
  const rows = await query(
    `SELECT p.id, p.name, p.opening_balance + COALESCE(SUM(t.amount), 0) AS balance
     FROM ${table} p LEFT JOIN ${ledger} t ON t.${column} = p.id AND t.store_id = p.store_id
     WHERE p.id = ? AND p.store_id = ? GROUP BY p.id`,
    [req.params.id, req.store.id],
  );
  return rows.length ? send(res, `${type} balance loaded`, rows[0]) : fail(res, `${type} not found`, 404);
}

const dashboard = {
  summary: wrap(async (req, res) => {
    const storeId = req.store.id;
    const [totals] = await query(
      `SELECT COUNT(*) AS totalProducts,
       COALESCE(SUM(stock.stock_value), 0) AS totalStockValue,
       COALESCE(SUM(COALESCE(stock.quantity, 0) <= p.minimum_stock), 0) AS lowStockCount
       FROM products p LEFT JOIN (
         SELECT product_id, SUM(quantity) quantity, SUM(quantity * purchase_price) stock_value
         FROM stock_batches WHERE store_id = ? GROUP BY product_id
       ) stock ON stock.product_id = p.id
       WHERE p.store_id = ? AND p.is_active = 1`,
      [storeId, storeId],
    );
    const [sales] = await query('SELECT COALESCE(SUM(total_amount),0) todaySales FROM sales WHERE store_id = ? AND status = ? AND sold_at >= UTC_DATE()', [storeId, 'completed']);
    const [purchases] = await query('SELECT COALESCE(SUM(total_amount),0) todayPurchase FROM purchases WHERE store_id = ? AND status = ? AND purchased_at >= UTC_DATE()', [storeId, 'completed']);
    const [profit] = await query(
      `SELECT COALESCE(SUM(
         (si.unit_price - si.unit_cost) * (si.quantity - si.returned_quantity)
         - CASE WHEN s.subtotal > 0 THEN s.discount_amount * si.line_total / s.subtotal
           * (si.quantity - si.returned_quantity) / si.quantity ELSE 0 END
       ),0) todayProfit
       FROM sale_items si JOIN sales s ON s.id = si.sale_id
       WHERE s.store_id = ? AND s.status = ? AND s.sold_at >= UTC_DATE()`,
      [storeId, 'completed'],
    );
    const [customerDue] = await query('SELECT COALESCE(SUM(c.opening_balance + COALESCE(t.balance,0)),0) total FROM customers c LEFT JOIN (SELECT customer_id, store_id, SUM(amount) balance FROM customer_transactions GROUP BY customer_id, store_id) t ON t.customer_id = c.id AND t.store_id = c.store_id WHERE c.store_id = ? AND c.is_active = 1', [storeId]);
    const [supplierDue] = await query('SELECT COALESCE(SUM(s.opening_balance + COALESCE(t.balance,0)),0) total FROM suppliers s LEFT JOIN (SELECT supplier_id, store_id, SUM(amount) balance FROM supplier_transactions GROUP BY supplier_id, store_id) t ON t.supplier_id = s.id AND t.store_id = s.store_id WHERE s.store_id = ? AND s.is_active = 1', [storeId]);
    const [expiry] = await query('SELECT SUM(expiry_date BETWEEN UTC_DATE() AND DATE_ADD(UTC_DATE(), INTERVAL 30 DAY)) expiringCount, SUM(expiry_date < UTC_DATE()) expiredCount FROM stock_batches WHERE store_id = ? AND quantity > 0', [storeId]);
    return send(res, 'Dashboard summary', { ...totals, ...sales, ...purchases, todayProfit: profit.todayProfit, lowStockCount: totals.lowStockCount || 0, expiringCount: expiry.expiringCount || 0, expiredCount: expiry.expiredCount || 0, customerDue: customerDue.total, supplierDue: supplierDue.total });
  }),
  alerts: wrap(async (req, res) => {
    const storeId = req.store.id;
    const [low] = await query(
      `SELECT p.id, p.name, p.minimum_stock, COALESCE(SUM(sb.quantity),0) quantity
       FROM products p LEFT JOIN stock_batches sb ON sb.product_id = p.id AND sb.store_id = p.store_id
       WHERE p.store_id = ? AND p.is_active = 1 GROUP BY p.id HAVING quantity <= p.minimum_stock ORDER BY p.name`,
      [storeId],
    );
    const expiry = await query('SELECT sb.id, sb.product_id, p.name, sb.quantity, sb.expiry_date FROM stock_batches sb JOIN products p ON p.id = sb.product_id WHERE sb.store_id = ? AND sb.quantity > 0 AND sb.expiry_date <= DATE_ADD(UTC_DATE(), INTERVAL 30 DAY) ORDER BY sb.expiry_date', [storeId]);
    return send(res, 'Dashboard alerts', { lowStock: low, expiry });
  }),
};

const reports = {
  sales: wrap(async (req, res) => reportTotals(req, res, 'sales', 'sold_at')),
  purchases: wrap(async (req, res) => reportTotals(req, res, 'purchases', 'purchased_at')),
  profit: wrap(async (req, res) => {
    const dateFilters = dateWhere(req.query, 's.sold_at');
    const rows = await query(
      `SELECT DATE(s.sold_at) date,
       SUM(si.unit_price * (si.quantity - si.returned_quantity)) revenue,
       SUM(si.unit_cost * (si.quantity - si.returned_quantity)) cost,
       SUM((si.unit_price - si.unit_cost) * (si.quantity - si.returned_quantity)
         - CASE WHEN s.subtotal > 0 THEN s.discount_amount * si.line_total / s.subtotal
           * (si.quantity - si.returned_quantity) / si.quantity ELSE 0 END) profit
       FROM sales s JOIN sale_items si ON si.sale_id = s.id
       WHERE s.store_id = ? AND s.status = ? ${dateFilters.sql} GROUP BY DATE(s.sold_at) ORDER BY date`,
      [req.store.id, 'completed', ...dateFilters.values],
    );
    return send(res, 'Profit report', rows);
  }),
  stock: wrap(async (req, res) => {
    const items = await query(
      `SELECT p.id, p.name, p.category_id, p.minimum_stock, COALESCE(SUM(sb.quantity),0) quantity,
       COALESCE(SUM(sb.quantity * sb.purchase_price),0) stock_value
       FROM products p LEFT JOIN stock_batches sb ON sb.product_id = p.id AND sb.store_id = p.store_id
       WHERE p.store_id = ? GROUP BY p.id ORDER BY p.name`,
      [req.store.id],
    );
    return send(res, 'Stock report', items);
  }),
  expiry: wrap(async (req, res) => {
    const rows = await query(
      `SELECT 'expired' AS record_type, b.id, b.product_id, p.name AS product_name, b.quantity, b.expiry_date AS occurred_on, NULL AS reason
       FROM stock_batches b JOIN products p ON p.id = b.product_id
       WHERE b.store_id = ? AND b.quantity > 0 AND b.expiry_date < UTC_DATE()
       UNION ALL
       SELECT st.type AS record_type, st.id, st.product_id, p.name, ABS(st.quantity_change), DATE(st.created_at), st.reason
       FROM stock_transactions st JOIN products p ON p.id = st.product_id
       WHERE st.store_id = ? AND st.type IN ('adjustment','expiry')
       ORDER BY occurred_on DESC`,
      [req.store.id, req.store.id],
    );
    return send(res, 'Expiry and wastage report', rows);
  }),
  topProducts: wrap(async (req, res) => {
    const rows = await query(
      `SELECT p.id, p.name, SUM(si.quantity) quantity_sold, SUM(si.line_total) revenue
       FROM sale_items si JOIN sales s ON s.id = si.sale_id JOIN products p ON p.id = si.product_id
       WHERE s.store_id = ? AND s.status = 'completed' GROUP BY p.id ORDER BY quantity_sold DESC LIMIT 20`,
      [req.store.id],
    );
    return send(res, 'Top products report', rows);
  }),
};

function dateWhere(params, column) {
  const filters = []; const values = [];
  if (params.from) { if (!isValidDate(params.from)) throw invalid('from must be YYYY-MM-DD'); filters.push(`${column} >= ?`); values.push(params.from); }
  if (params.to) { if (!isValidDate(params.to)) throw invalid('to must be YYYY-MM-DD'); filters.push(`${column} < DATE_ADD(?, INTERVAL 1 DAY)`); values.push(params.to); }
  return { sql: filters.length ? `AND ${filters.join(' AND ')}` : '', values };
}

async function reportTotals(req, res, table, dateColumn) {
  const date = dateWhere(req.query, `t.${dateColumn}`);
  const rows = await query(
    `SELECT DATE(t.${dateColumn}) date, COUNT(*) count, SUM(t.total_amount) total, SUM(t.paid_amount) paid
     FROM ${table} t WHERE t.store_id = ? AND t.status = 'completed' ${date.sql}
     GROUP BY DATE(t.${dateColumn}) ORDER BY date`,
    [req.store.id, ...date.values],
  );
  return send(res, `${table} report`, rows);
}

const notifications = {
  list: wrap(async (req, res) => {
    const { page, limit } = pagination(req.query);
    const [count] = await query('SELECT COUNT(*) AS total FROM notifications WHERE store_id = ? AND (user_id IS NULL OR user_id = ?)', [req.store.id, req.user.id]);
    const items = await query('SELECT * FROM notifications WHERE store_id = ? AND (user_id IS NULL OR user_id = ?) ORDER BY id DESC LIMIT ? OFFSET ?', [req.store.id, req.user.id, limit, (page - 1) * limit]);
    return send(res, 'Notifications loaded', { items, pagination: { page, limit, total: count[0].total, pages: Math.ceil(count[0].total / limit) } });
  }),
  read: wrap(async (req, res) => {
    const result = await query('UPDATE notifications SET is_read = 1 WHERE id = ? AND store_id = ? AND (user_id IS NULL OR user_id = ?)', [req.params.id, req.store.id, req.user.id]);
    return result.affectedRows ? send(res, 'Notification marked as read', null) : fail(res, 'Notification not found', 404);
  }),
  readAll: wrap(async (req, res) => {
    const result = await query('UPDATE notifications SET is_read = 1 WHERE store_id = ? AND (user_id IS NULL OR user_id = ?)', [req.store.id, req.user.id]);
    return send(res, 'Notifications marked as read', { updated: result.affectedRows });
  }),
};

module.exports = {
  purchases, sales, inventory, payments, dashboard, reports, notifications,
  customerBalance: wrap((req, res) => balance(req, res, 'customer')),
  supplierBalance: wrap((req, res) => balance(req, res, 'supplier')),
};
