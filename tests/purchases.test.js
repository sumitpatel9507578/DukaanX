const test = require('node:test');
const assert = require('node:assert/strict');
const validate = require('../src/validators/purchase.validator');

test('purchase validation requires valid line items', () => {
  assert.match(validate.create({ items: [] }), /at least one item/);
  assert.match(validate.create({ items: [{ product_id: 1, quantity: 0, unit_cost: 5 }] }), /quantity/);
  assert.equal(validate.create({ items: [{ product_id: 1, quantity: 2, unit_cost: 5 }] }), null);
});

test('purchase validation rejects negative discounts', () => {
  assert.match(validate.create({ items: [{ product_id: 1, quantity: 1, unit_cost: 1 }], discount_amount: -1 }), /Discount/);
});
