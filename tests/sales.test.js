const test = require('node:test');
const assert = require('node:assert/strict');
const validate = require('../src/validators/sale.validator');

test('sale validation requires products with positive quantities', () => {
  assert.match(validate.create({ items: [] }), /at least one item/);
  assert.match(validate.create({ items: [{ product_id: 1, quantity: -2 }] }), /quantity/);
  assert.equal(validate.create({ items: [{ product_id: 1, quantity: 2 }] }), null);
});

test('return validation uses the required product and quantity fields', () => {
  assert.match(validate.return({ items: [{ product_id: 1, quantity: 0 }] }), /quantity/);
  assert.equal(validate.return({ items: [{ product_id: 1, quantity: 1 }] }), null);
});
