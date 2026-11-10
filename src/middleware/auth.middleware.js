const { query } = require('../config/db');
const { verifyToken } = require('../utils/jwt');
const { fail } = require('../utils/response');

async function authenticate(req, res, next) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return fail(res, 'Authentication required', 401);
  try {
    const payload = verifyToken(token);
    if (!payload || !Number.isInteger(payload.userId)) return fail(res, 'Invalid token', 401);
    const rows = await query('SELECT id, email, name FROM users WHERE id = ? AND is_active = 1', [payload.userId]);
    if (!rows.length) return fail(res, 'Invalid token', 401);
    req.user = rows[0];
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return fail(res, 'Invalid or expired token', 401);
    }
    return next(error);
  }
}

async function requireStore(req, res, next) {
  const storeId = Number(req.get('X-Store-Id'));
  if (!Number.isSafeInteger(storeId) || storeId < 1) return fail(res, 'A valid X-Store-Id header is required', 400);
  try {
    const stores = await query(
      'SELECT s.id, s.name, sm.role FROM stores s JOIN store_members sm ON sm.store_id = s.id WHERE s.id = ? AND sm.user_id = ? AND s.is_active = 1',
      [storeId, req.user.id],
    );
    if (!stores.length) return fail(res, 'Store not found or access denied', 404);
    req.store = stores[0];
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { authenticate, requireStore };
