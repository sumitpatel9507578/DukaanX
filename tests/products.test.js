const test = require('node:test');
const assert = require('node:assert/strict');
const validate = require('../src/validators/product.validator');

test('product validation requires a name and rejects negative prices', () => {
  assert.match(validate.create({}), /name/i);
  assert.match(validate.create({ name: 'Milk', selling_price: -1 }), /selling_price/);
  assert.equal(validate.create({ name: 'Milk', purchase_price: 10, selling_price: 15 }), null);
});

test('product updates allow partial fields but validate supplied prices', () => {
  assert.equal(validate.update({ selling_price: 12 }), null);
  assert.match(validate.update({ minimum_stock: -1 }), /minimum_stock/);
});
