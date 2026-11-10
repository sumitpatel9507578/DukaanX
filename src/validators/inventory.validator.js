const reasons = new Set(['damaged', 'lost', 'found', 'correction', 'wastage', 'other']);
const { isValidDate } = require('../utils/date');
module.exports = {
  adjustment: (body) => {
    if (!body.product_id || !reasons.has(body.reason)
      || !Number.isFinite(Number(body.quantity_change)) || Number(body.quantity_change) === 0
      || Math.abs(Number(body.quantity_change)) > 99999999999.999
      || Math.abs(Number(body.quantity_change) * 1000 - Math.round(Number(body.quantity_change) * 1000)) > 1e-7) {
      return 'A valid product_id, reason, and non-zero quantity_change are required';
    }
    if (body.expiry_date != null && !isValidDate(body.expiry_date)) return 'expiry_date must use YYYY-MM-DD';
    if (body.purchase_price !== undefined && (!Number.isFinite(Number(body.purchase_price)) || Number(body.purchase_price) < 0
      || Math.abs(Number(body.purchase_price) * 100 - Math.round(Number(body.purchase_price) * 100)) > 1e-7)) {
      return 'purchase_price must be non-negative with at most 2 decimal places';
    }
    return null;
  },
};
