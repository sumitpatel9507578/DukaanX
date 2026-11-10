const { positiveNumber } = require('./shared.validator');

function validate(body) {
  if (!Array.isArray(body.items) || !body.items.length) return 'Sale must contain at least one item';
  if (body.items.some((item) => !item.product_id || !positiveNumber(item.quantity)
    || Math.abs(Number(item.quantity) * 1000 - Math.round(Number(item.quantity) * 1000)) > 1e-7
    || (item.unit_price !== undefined && (!Number.isFinite(Number(item.unit_price)) || Number(item.unit_price) < 0
      || Math.abs(Number(item.unit_price) * 100 - Math.round(Number(item.unit_price) * 100)) > 1e-7)))) return 'Sale items require product_id, quantity with at most 3 decimals, and unit price with at most 2 decimals';
  if (body.discount_amount !== undefined && (!Number.isFinite(Number(body.discount_amount)) || Number(body.discount_amount) < 0
    || Math.abs(Number(body.discount_amount) * 100 - Math.round(Number(body.discount_amount) * 100)) > 1e-7)) return 'Discount must be non-negative and support at most 2 decimal places';
  return null;
}

module.exports = { create: validate, update: validate, return: validate };
