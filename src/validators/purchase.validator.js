const { positiveNumber } = require('./shared.validator');
const { isValidDate } = require('../utils/date');

function validate(body) {
  if (!Array.isArray(body.items) || !body.items.length) return 'Purchase must contain at least one item';
  if (body.items.some((item) => !item.product_id || !positiveNumber(item.quantity)
    || Math.abs(Number(item.quantity) * 1000 - Math.round(Number(item.quantity) * 1000)) > 1e-7
    || !Number.isFinite(Number(item.unit_cost ?? item.purchase_price))
    || Number(item.unit_cost ?? item.purchase_price) < 0
    || Math.abs(Number(item.unit_cost ?? item.purchase_price) * 100 - Math.round(Number(item.unit_cost ?? item.purchase_price) * 100)) > 1e-7)) return 'Purchase items require product_id, quantity with at most 3 decimals, and unit cost with at most 2 decimals';
  if (body.discount_amount !== undefined && (!Number.isFinite(Number(body.discount_amount)) || Number(body.discount_amount) < 0)) return 'Discount must be zero or greater';
  if (body.discount_amount !== undefined && Math.abs(Number(body.discount_amount) * 100 - Math.round(Number(body.discount_amount) * 100)) > 1e-7) return 'Discount supports at most 2 decimal places';
  for (const item of body.items) {
    for (const field of ['manufacturing_date', 'expiry_date']) {
      if (item[field] != null && !isValidDate(item[field])) return `${field} must use YYYY-MM-DD`;
    }
  }
  return null;
}

module.exports = { create: validate, update: validate };
