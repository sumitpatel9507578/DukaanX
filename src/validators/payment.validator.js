const methods = new Set(['cash', 'upi', 'card', 'bank_transfer', 'credit', 'mixed']);
module.exports = {
  create: (body) => {
    if (!['customer', 'supplier'].includes(body.party_type) || !body.party_id
      || !Number.isFinite(Number(body.amount)) || Number(body.amount) <= 0
      || Number(body.amount) > 999999999999.99
      || Math.abs(Number(body.amount) * 100 - Math.round(Number(body.amount) * 100)) > 1e-7) {
      return 'Valid party and positive amount are required';
    }
    if (body.transaction_type === 'adjustment') {
      return !['credit', 'debit'].includes(body.adjustment_direction) || !body.reason
        ? 'Adjustment requires a credit/debit direction and reason'
        : null;
    }
    return !methods.has(body.method) || !['received', 'paid'].includes(body.direction)
      ? 'Valid payment method and party-appropriate direction are required'
      : null;
  },
};
