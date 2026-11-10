const test = require('node:test');
const assert = require('node:assert/strict');
const validate = require('../src/validators/inventory.validator');

test('stock adjustment accepts only valid reasons and non-zero deltas', () => {
  assert.match(validate.adjustment({ product_id: 1, reason: 'unknown', quantity_change: 2 }), /valid product_id/);
  assert.match(validate.adjustment({ product_id: 1, reason: 'found', quantity_change: 0 }), /non-zero/);
  assert.equal(validate.adjustment({ product_id: 1, reason: 'found', quantity_change: 2 }), null);
  assert.equal(validate.adjustment({ product_id: 1, reason: 'damaged', quantity_change: -2 }), null);
});
