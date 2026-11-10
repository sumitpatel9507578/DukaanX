const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, comparePassword } = require('../src/utils/password');
const { signToken, verifyToken } = require('../src/utils/jwt');
const validate = require('../src/validators/auth.validator');

test('password hashes verify without exposing the original value', async () => {
  const hash = await hashPassword('a-long-test-password');
  assert.notEqual(hash, 'a-long-test-password');
  assert.equal(await comparePassword('a-long-test-password', hash), true);
  assert.equal(await comparePassword('incorrect-password', hash), false);
});

test('JWT carries only the user identity and email', () => {
  process.env.JWT_SECRET = 'test-secret-with-more-than-thirty-two-characters';
  const payload = verifyToken(signToken({ id: 17, email: 'shop@example.test', password_hash: 'not-in-token' }));
  assert.equal(payload.userId, 17);
  assert.equal(payload.email, 'shop@example.test');
  assert.equal(payload.password_hash, undefined);
});

test('registration validation rejects invalid email and short passwords', () => {
  assert.equal(validate.register({ name: 'Test', email: 'not-an-email', password: 'long-password' }), 'A valid email is required');
  assert.equal(validate.register({ name: 'Test', email: 'test@example.test', password: 'short' }), 'Password must be at least 8 characters');
  assert.equal(validate.register({ name: 'Test', email: 'test@example.test', password: 'long-password' }), null);
});

test('health endpoint responds without a database connection', async (t) => {
  const app = require('../src/app');
  const server = app.listen(0);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once('listening', resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    message: 'DukaanX API is healthy',
    data: null,
  });
});

test('protected API rejects missing JWTs before requiring store/database access', async (t) => {
  const app = require('../src/app');
  const server = app.listen(0);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once('listening', resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/products`);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    success: false,
    message: 'Authentication required',
    error: null,
  });
});
