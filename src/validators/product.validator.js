const { requiredText } = require('./shared.validator');

function validate(body, partial = false) {
  if (!partial) {
    const required = requiredText(body, ['name']);
    if (required) return required;
  }
  for (const field of ['purchase_price', 'selling_price']) {
    if (body[field] !== undefined && (!Number.isFinite(Number(body[field])) || Number(body[field]) < 0 || Number(body[field]) > 999999999999.99)) return `${field} must be within the supported non-negative price range`;
    if (body[field] !== undefined && Math.abs(Number(body[field]) * 100 - Math.round(Number(body[field]) * 100)) > 1e-7) return `${field} supports at most 2 decimal places`;
  }
  if (body.minimum_stock !== undefined && (!Number.isFinite(Number(body.minimum_stock)) || Number(body.minimum_stock) < 0
    || Number(body.minimum_stock) > 99999999999.999
    || Math.abs(Number(body.minimum_stock) * 1000 - Math.round(Number(body.minimum_stock) * 1000)) > 1e-7)) return 'minimum_stock must be non-negative with at most 3 decimal places';
  if (body.category_id !== undefined && body.category_id !== null
    && (!Number.isSafeInteger(Number(body.category_id)) || Number(body.category_id) < 1)) return 'category_id must be a positive integer';
  return null;
}

module.exports = { create: (body) => validate(body), update: (body) => validate(body, true) };
