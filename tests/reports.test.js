const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidDate } = require('../src/utils/date');
const { pagination } = require('../src/utils/pagination');

test('date filters accept real ISO calendar dates only', () => {
  assert.equal(isValidDate('2026-11-10'), true);
  assert.equal(isValidDate('2026-02-30'), false);
  assert.equal(isValidDate('10-11-2026'), false);
});

test('pagination enforces positive pages and a maximum page size', () => {
  assert.deepEqual(pagination({ page: '0', limit: '1000' }), { page: 1, limit: 100, offset: 0 });
  assert.deepEqual(pagination({ page: '3', limit: '10' }), { page: 3, limit: 10, offset: 20 });
});

test('all required API endpoint declarations are present', () => {
  const modules = ['auth', 'store', 'category', 'product', 'supplier', 'customer', 'purchase', 'sale', 'inventory', 'payment', 'dashboard', 'report', 'notification'];
  const count = modules.reduce((total, name) => {
    const router = require(`../src/routes/${name}.routes`);
    return total + router.stack.filter((layer) => layer.route).length;
  }, 0);
  assert.equal(count, 65);
});
