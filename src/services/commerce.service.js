const { transaction } = require('../config/db');

const invalid = (message, status = 400) => Object.assign(new Error(message), { status });
const number = (value, label, min = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) throw invalid(`${label} must be ${min ? 'greater than zero' : 'zero or greater'}`);
  return parsed;
};
const decimal = (value, label, places, max) => {
  const parsed = number(value, label);
  const rounded = Math.round(parsed * (10 ** places)) / (10 ** places);
  if (parsed > max || Math.abs(parsed - rounded) > 1e-8) {
    throw invalid(`${label} supports at most ${places} decimal places`);
  }
  return rounded;
};
const quantity = (value, label) => {
  const parsed = decimal(value, label, 3, 99999999999.999);
  if (parsed <= 0) throw invalid(`${label} must be greater than zero`);
  return parsed;
};
const money = (value, label) => decimal(value, label, 2, 999999999999.99);

async function ensureParty(connection, table, id, storeId) {
  if (!id) return;
  const [rows] = await connection.execute(`SELECT id FROM ${table} WHERE id = ? AND store_id = ? AND is_active = 1 FOR UPDATE`, [id, storeId]);
  if (!rows.length) throw invalid(`${table.slice(0, -1)} not found`, 404);
}

async function ensureProduct(connection, id, storeId) {
  const [rows] = await connection.execute('SELECT id FROM products WHERE id = ? AND store_id = ? AND is_active = 1 FOR UPDATE', [id, storeId]);
  if (!rows.length) throw invalid(`Product ${id} not found or inactive`, 404);
}

async function insertStockTransaction(connection, storeId, productId, batchId, type, quantity, refType, refId, userId, reason = null) {
  await connection.execute(
    `INSERT INTO stock_transactions
      (store_id, product_id, batch_id, type, quantity_change, reference_type, reference_id, reason, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [storeId, productId, batchId, type, quantity, refType, refId, reason, userId],
  );
}

async function insertLedger(connection, table, storeId, partyId, type, amount, refType, refId, userId, description) {
  const partyColumn = table === 'customer_transactions' ? 'customer_id' : 'supplier_id';
  await connection.execute(
    `INSERT INTO ${table} (store_id, ${partyColumn}, type, amount, reference_type, reference_id, description, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [storeId, partyId, type, amount, refType, refId, description, userId],
  );
}

async function createPurchase(input, storeId, userId, id = null) {
  const items = input.items;
  if (!Array.isArray(items) || items.length === 0) throw invalid('Purchase must contain at least one item');
  return transaction(async (connection) => {
    await ensureParty(connection, 'suppliers', input.supplier_id, storeId);
    const prepared = [];
    let subtotal = 0;
    for (const item of items) {
      const itemQuantity = quantity(item.quantity, 'Item quantity');
      const unitCost = money(item.unit_cost ?? item.purchase_price, 'Unit cost');
      await ensureProduct(connection, item.product_id, storeId);
      const lineTotal = Math.round(itemQuantity * unitCost * 100) / 100;
      subtotal += lineTotal;
      prepared.push({ ...item, quantity: itemQuantity, unitCost, lineTotal });
    }
    const discount = money(input.discount_amount || 0, 'Discount');
    if (discount > subtotal) throw invalid('Discount cannot exceed subtotal');
    const total = Math.round((subtotal - discount) * 100) / 100;
    const paid = money(input.paid_amount || 0, 'Paid amount');
    if (paid > total) throw invalid('Paid amount cannot exceed purchase total');
    const paymentMethods = ['cash', 'upi', 'card', 'bank_transfer', 'credit', 'mixed'];
    const paymentMethod = input.payment_method || 'cash';
    if (paid > 0 && !paymentMethods.includes(paymentMethod)) throw invalid('Unsupported payment method');
    if (paid > 0 && paymentMethod === 'credit') throw invalid('Credit is not a payment method for an amount already paid');
    let purchaseId = id;
    if (id) {
      const [old] = await connection.execute('SELECT id, supplier_id, total_amount, paid_amount FROM purchases WHERE id = ? AND store_id = ? AND status = ? FOR UPDATE', [id, storeId, 'completed']);
      if (!old.length) throw invalid('Purchase not found or cancelled', 404);
      if (Number(old[0].paid_amount) > 0) throw invalid('A purchase with payments cannot be edited; record a correction instead', 409);
      const [lines] = await connection.execute(
        'SELECT pi.*, sb.quantity AS available FROM purchase_items pi JOIN stock_batches sb ON sb.id = pi.batch_id WHERE pi.purchase_id = ? FOR UPDATE',
        [id],
      );
      for (const line of lines) {
        if (Number(line.available) < Number(line.quantity)) throw invalid('Purchase cannot be edited because some of its stock has already been consumed', 409);
      }
      for (const line of lines) {
        await connection.execute('UPDATE stock_batches SET quantity = quantity - ? WHERE id = ?', [line.quantity, line.batch_id]);
        await insertStockTransaction(connection, storeId, line.product_id, line.batch_id, 'purchase_reversal', -Number(line.quantity), 'purchase', id, userId, 'Purchase edit reversal');
      }
      if (old[0].supplier_id) {
        await insertLedger(connection, 'supplier_transactions', storeId, old[0].supplier_id, 'purchase_reversal', -Number(old[0].total_amount), 'purchase', id, userId, 'Purchase edit reversal');
      }
      await connection.execute('DELETE FROM purchase_items WHERE purchase_id = ?', [id]);
      await connection.execute('UPDATE purchases SET supplier_id = ?, invoice_number = ?, subtotal = ?, discount_amount = ?, total_amount = ?, paid_amount = ?, notes = ? WHERE id = ?',
        [input.supplier_id || null, input.invoice_number || null, subtotal, discount, total, paid, input.notes || null, id]);
    } else {
      const [result] = await connection.execute(
        `INSERT INTO purchases (store_id, supplier_id, invoice_number, subtotal, discount_amount, total_amount, paid_amount, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [storeId, input.supplier_id || null, input.invoice_number || null, subtotal, discount, total, paid, input.notes || null, userId],
      );
      purchaseId = result.insertId;
    }
    for (const item of prepared) {
      const [batch] = await connection.execute(
        `INSERT INTO stock_batches (store_id, product_id, batch_number, quantity, purchase_price, manufacturing_date, expiry_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [storeId, item.product_id, item.batch_number || null, item.quantity, item.unitCost, item.manufacturing_date || null, item.expiry_date || null],
      );
      await connection.execute(
        'INSERT INTO purchase_items (purchase_id, product_id, batch_id, quantity, unit_cost, line_total) VALUES (?, ?, ?, ?, ?, ?)',
        [purchaseId, item.product_id, batch.insertId, item.quantity, item.unitCost, item.lineTotal],
      );
      await insertStockTransaction(connection, storeId, item.product_id, batch.insertId, 'purchase', item.quantity, 'purchase', purchaseId, userId);
    }
    if (input.supplier_id) {
      if (total) await insertLedger(connection, 'supplier_transactions', storeId, input.supplier_id, id ? 'purchase_edit' : 'purchase', total, 'purchase', purchaseId, userId, 'Purchase balance');
      if (paid > 0) {
        const [payment] = await connection.execute(
          `INSERT INTO payments (store_id, party_type, party_id, amount, method, direction, reference, notes, created_by)
           VALUES (?, 'supplier', ?, ?, ?, 'paid', ?, ?, ?)`,
          [storeId, input.supplier_id, paid, paymentMethod, `purchase:${purchaseId}`, 'Purchase payment', userId],
        );
        await insertLedger(connection, 'supplier_transactions', storeId, input.supplier_id, 'payment', -paid, 'payment', payment.insertId, userId, 'Purchase payment');
      }
    }
    const [rows] = await connection.execute('SELECT * FROM purchases WHERE id = ?', [purchaseId]);
    return rows[0];
  });
}

async function allocateStock(connection, storeId, productId, quantity) {
  const [batches] = await connection.execute(
    `SELECT id, quantity, purchase_price FROM stock_batches
     WHERE store_id = ? AND product_id = ? AND quantity > 0
       AND (expiry_date IS NULL OR expiry_date >= UTC_DATE())
     ORDER BY expiry_date IS NULL, expiry_date ASC, id ASC FOR UPDATE`,
    [storeId, productId],
  );
  const available = batches.reduce((sum, batch) => sum + Number(batch.quantity), 0);
  if (available < quantity) throw invalid(`Insufficient stock for product ${productId}`, 409);
  let remaining = quantity;
  const allocations = [];
  for (const batch of batches) {
    if (!remaining) break;
    const take = Math.min(remaining, Number(batch.quantity));
    allocations.push({ ...batch, quantity: take });
    remaining = Math.round((remaining - take) * 1000) / 1000;
  }
  return allocations;
}

async function applySaleItems(connection, items, storeId, saleId, userId) {
  for (const item of items) {
    const itemQuantity = quantity(item.quantity, 'Item quantity');
    await ensureProduct(connection, item.product_id, storeId);
    const [productRows] = await connection.execute('SELECT selling_price FROM products WHERE id = ?', [item.product_id]);
    const unitPrice = money(item.unit_price ?? productRows[0].selling_price, 'Unit price');
    const allocations = await allocateStock(connection, storeId, item.product_id, itemQuantity);
    const totalLine = Math.round(itemQuantity * unitPrice * 100) / 100;
    let allocatedTotal = 0;
    let lineRemaining = itemQuantity;
    for (const [index, allocation] of allocations.entries()) {
      const lineTotal = index === allocations.length - 1
        ? Math.round((totalLine - allocatedTotal) * 100) / 100
        : Math.round(allocation.quantity * unitPrice * 100) / 100;
      allocatedTotal += lineTotal;
      await connection.execute('UPDATE stock_batches SET quantity = quantity - ? WHERE id = ?', [allocation.quantity, allocation.id]);
      await connection.execute(
        'INSERT INTO sale_items (sale_id, product_id, batch_id, quantity, unit_price, unit_cost, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [saleId, item.product_id, allocation.id, allocation.quantity, unitPrice, allocation.purchase_price, lineTotal],
      );
      await insertStockTransaction(connection, storeId, item.product_id, allocation.id, 'sale', -allocation.quantity, 'sale', saleId, userId);
      lineRemaining = Math.round((lineRemaining - allocation.quantity) * 1000) / 1000;
    }
    if (lineRemaining > 0) throw invalid(`Insufficient stock for product ${item.product_id}`, 409);
  }
}

async function createSale(input, storeId, userId, id = null) {
  if (!Array.isArray(input.items) || input.items.length === 0) throw invalid('Sale must contain at least one item');
  return transaction(async (connection) => {
    await ensureParty(connection, 'customers', input.customer_id, storeId);
    let existing;
    if (id) {
      const [rows] = await connection.execute('SELECT * FROM sales WHERE id = ? AND store_id = ? AND status = ? FOR UPDATE', [id, storeId, 'completed']);
      if (!rows.length) throw invalid('Sale not found or cancelled', 404);
      existing = rows[0];
        if (Number(existing.paid_amount) > 0) throw invalid('A paid sale cannot be edited; process a return and create a corrected sale', 409);
      const [returned] = await connection.execute('SELECT SUM(returned_quantity) AS returned FROM sale_items WHERE sale_id = ?', [id]);
      if (Number(returned[0].returned || 0) > 0) throw invalid('A sale with returns cannot be edited', 409);
      const [lines] = await connection.execute('SELECT * FROM sale_items WHERE sale_id = ? FOR UPDATE', [id]);
      for (const line of lines) {
        await connection.execute('UPDATE stock_batches SET quantity = quantity + ? WHERE id = ?', [line.quantity, line.batch_id]);
        await insertStockTransaction(connection, storeId, line.product_id, line.batch_id, 'sale_reversal', Number(line.quantity), 'sale', id, userId, 'Sale edit reversal');
      }
      if (existing.customer_id && Number(existing.total_amount) > 0) {
        await insertLedger(connection, 'customer_transactions', storeId, existing.customer_id, 'sale_reversal', -Number(existing.total_amount), 'sale', id, userId, 'Sale edit reversal');
      }
      await connection.execute('DELETE FROM sale_items WHERE sale_id = ?', [id]);
    }
    let subtotal = 0;
    for (const item of input.items) {
      const itemQuantity = quantity(item.quantity, 'Item quantity');
      await ensureProduct(connection, item.product_id, storeId);
      const [product] = await connection.execute('SELECT selling_price FROM products WHERE id = ?', [item.product_id]);
      subtotal += itemQuantity * money(item.unit_price ?? product[0].selling_price, 'Unit price');
    }
    const discount = money(input.discount_amount || 0, 'Discount');
    if (discount > subtotal) throw invalid('Discount cannot exceed subtotal');
    subtotal = Math.round(subtotal * 100) / 100;
    const total = Math.round((subtotal - discount) * 100) / 100;
    const methods = ['cash', 'upi', 'card', 'bank_transfer', 'credit', 'mixed'];
    const method = input.payment_method || 'cash';
    if (!methods.includes(method)) throw invalid('Unsupported payment method');
    const paid = money(input.paid_amount ?? (input.payment_method === 'credit' ? 0 : total), 'Paid amount');
    if (paid > total) throw invalid('Paid amount cannot exceed sale total');
    if (method === 'credit' && paid !== 0) throw invalid('Credit sales cannot include an immediate paid amount');
    if (paid < total && !input.customer_id) throw invalid('A customer is required for credit sales');
    let saleId = id;
    if (id) {
      await connection.execute(
        'UPDATE sales SET customer_id = ?, subtotal = ?, discount_amount = ?, total_amount = ?, paid_amount = ?, notes = ? WHERE id = ?',
        [input.customer_id || null, subtotal, discount, total, paid, input.notes || null, id],
      );
    } else {
      const [result] = await connection.execute(
        'INSERT INTO sales (store_id, customer_id, subtotal, discount_amount, total_amount, paid_amount, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [storeId, input.customer_id || null, subtotal, discount, total, paid, input.notes || null, userId],
      );
      saleId = result.insertId;
    }
    await applySaleItems(connection, input.items, storeId, saleId, userId);
    if (input.customer_id && total) await insertLedger(connection, 'customer_transactions', storeId, input.customer_id, id ? 'sale_edit' : 'sale', total, 'sale', saleId, userId, 'Sale balance');
    if (input.customer_id && paid > 0) {
      const [payment] = await connection.execute(
        `INSERT INTO payments (store_id, party_type, party_id, amount, method, direction, reference, notes, created_by)
         VALUES (?, 'customer', ?, ?, ?, 'received', ?, ?, ?)`,
        [storeId, input.customer_id, paid, method, `sale:${saleId}`, 'Sale payment', userId],
      );
      await insertLedger(connection, 'customer_transactions', storeId, input.customer_id, 'payment', -paid, 'payment', payment.insertId, userId, 'Sale payment');
    }
    const [rows] = await connection.execute('SELECT * FROM sales WHERE id = ?', [saleId]);
    return rows[0];
  });
}

async function cancelPurchase(id, storeId, userId) {
  return transaction(async (connection) => {
    const [rows] = await connection.execute('SELECT * FROM purchases WHERE id = ? AND store_id = ? AND status = ? FOR UPDATE', [id, storeId, 'completed']);
    if (!rows.length) throw invalid('Purchase not found or already cancelled', 404);
    const purchase = rows[0];
    const [lines] = await connection.execute('SELECT * FROM purchase_items WHERE purchase_id = ? FOR UPDATE', [id]);
    for (const line of lines) {
      const [batches] = await connection.execute('SELECT quantity FROM stock_batches WHERE id = ? FOR UPDATE', [line.batch_id]);
      if (!batches.length || Number(batches[0].quantity) < Number(line.quantity)) throw invalid('Purchase cannot be cancelled because purchased stock has been consumed', 409);
    }
    for (const line of lines) {
      await connection.execute('UPDATE stock_batches SET quantity = quantity - ? WHERE id = ?', [line.quantity, line.batch_id]);
      await insertStockTransaction(connection, storeId, line.product_id, line.batch_id, 'purchase_reversal', -Number(line.quantity), 'purchase', id, userId, 'Purchase cancelled');
    }
    if (purchase.supplier_id) await insertLedger(connection, 'supplier_transactions', storeId, purchase.supplier_id, 'purchase_reversal', -Number(purchase.total_amount), 'purchase', id, userId, 'Purchase cancelled');
    await connection.execute('UPDATE purchases SET status = ? WHERE id = ?', ['cancelled', id]);
    return { id: Number(id), status: 'cancelled' };
  });
}

async function returnSale(id, storeId, userId, input) {
  if (!Array.isArray(input.items) || !input.items.length) throw invalid('At least one returned item is required');
  return transaction(async (connection) => {
    const [sales] = await connection.execute('SELECT * FROM sales WHERE id = ? AND store_id = ? AND status = ? FOR UPDATE', [id, storeId, 'completed']);
    if (!sales.length) throw invalid('Sale not found', 404);
    const sale = sales[0];
    if (input.refund_method && !['cash', 'upi', 'card', 'bank_transfer', 'credit', 'mixed'].includes(input.refund_method)) {
      throw invalid('Unsupported refund method');
    }
    let refundTotal = 0;
    for (const item of input.items) {
      let remaining = quantity(item.quantity, 'Return quantity');
      const [lines] = await connection.execute(
        `SELECT si.*, s.discount_amount, s.subtotal FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         WHERE si.sale_id = ? AND si.product_id = ? AND si.returned_quantity < si.quantity
         ORDER BY si.id FOR UPDATE`,
        [id, item.product_id],
      );
      for (const line of lines) {
        if (!remaining) break;
        const quantity = Math.min(remaining, Number(line.quantity) - Number(line.returned_quantity));
        await connection.execute('UPDATE sale_items SET returned_quantity = returned_quantity + ? WHERE id = ?', [quantity, line.id]);
        await connection.execute('UPDATE stock_batches SET quantity = quantity + ? WHERE id = ?', [quantity, line.batch_id]);
        await insertStockTransaction(connection, storeId, item.product_id, line.batch_id, 'sale_return', quantity, 'sale', id, userId);
        const discountPerUnit = Number(line.subtotal) > 0
          ? Number(line.discount_amount) * Number(line.line_total) / Number(line.subtotal) / Number(line.quantity)
          : 0;
        refundTotal += quantity * (Number(line.unit_price) - discountPerUnit);
        remaining -= quantity;
      }
      if (remaining > 0) throw invalid(`Return quantity exceeds the unreturned quantity for product ${item.product_id}`);
    }
    refundTotal = Math.round(refundTotal * 100) / 100;
    if (sale.customer_id && refundTotal) await insertLedger(connection, 'customer_transactions', storeId, sale.customer_id, 'return', -refundTotal, 'sale', id, userId, input.reason || 'Sale return');
    if (refundTotal && input.refund_method) {
      await connection.execute(
        `INSERT INTO payments (store_id, party_type, party_id, amount, method, direction, reference, notes, created_by)
         VALUES (?, 'customer', ?, ?, ?, 'refund', ?, ?, ?)`,
        [storeId, sale.customer_id, refundTotal, input.refund_method, `sale:${id}`, input.reason || null, userId],
      );
    }
    return { sale_id: Number(id), returned_amount: refundTotal };
  });
}

module.exports = { createPurchase, createSale, cancelPurchase, returnSale };
