const crypto = require('node:crypto');
const nodemailer = require('nodemailer');
const { query } = require('../config/db');
const { signToken } = require('../utils/jwt');
const { hashPassword, comparePassword } = require('../utils/password');
const { success, fail } = require('../utils/response');
const resources = require('../services/resource.service');

const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const send = (res, message, data, status) => success(res, message, data, status);

const auth = {
  register: wrap(async (req, res) => {
    const { name, email, password, phone } = req.body;
    if (!name || typeof name !== 'string' || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 8) return fail(res, 'Name, valid email, and password of at least 8 characters are required', 400);
    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing.length) return fail(res, 'Email is already registered', 409);
    const passwordHash = await hashPassword(password);
    const result = await query('INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?)', [name.trim(), normalizedEmail, phone || null, passwordHash]);
    const user = { id: result.insertId, name: name.trim(), email: normalizedEmail };
    return send(res, 'Account registered successfully', { user, token: signToken(user) }, 201);
  }),
  login: wrap(async (req, res) => {
    const { email, password } = req.body;
    const users = await query('SELECT id, name, email, password_hash FROM users WHERE email = ? AND is_active = 1', [String(email || '').trim().toLowerCase()]);
    if (!users.length || !await comparePassword(password || '', users[0].password_hash)) return fail(res, 'Invalid email or password', 401);
    const { id, name } = users[0];
    return send(res, 'Login successful', { user: { id, name, email: users[0].email }, token: signToken({ id, email: users[0].email }) });
  }),
  forgotPassword: wrap(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, 'A valid email is required', 400);
    const smtp = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'].every((key) => process.env[key]);
    if (!smtp) return fail(res, 'Password reset delivery is not configured', 503);
    const users = await query('SELECT id, email FROM users WHERE email = ? AND is_active = 1', [email]);
    const message = 'If the account exists, password reset instructions have been sent';
    if (!users.length) return send(res, message, null);
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await query('UPDATE users SET reset_token_hash = ?, reset_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 HOUR) WHERE id = ?', [tokenHash, users[0].id]);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    });
    const resetUrl = `${process.env.APP_URL || 'http://localhost:5000'}/reset-password?token=${token}`;
    await transporter.sendMail({ from: process.env.SMTP_FROM, to: users[0].email, subject: 'DukaanX password reset', text: `Use this one-time link within one hour: ${resetUrl}` });
    return send(res, message, null);
  }),
  resetPassword: wrap(async (req, res) => {
    const { token, password } = req.body;
    if (!token || typeof password !== 'string' || password.length < 8) return fail(res, 'A reset token and password of at least 8 characters are required', 400);
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const users = await query('SELECT id FROM users WHERE reset_token_hash = ? AND reset_expires_at > UTC_TIMESTAMP() AND is_active = 1', [hash]);
    if (!users.length) return fail(res, 'Reset token is invalid or expired', 400);
    const passwordHash = await hashPassword(password);
    await query('UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_expires_at = NULL WHERE id = ?', [passwordHash, users[0].id]);
    return send(res, 'Password reset successfully', null);
  }),
  me: wrap(async (req, res) => {
    const users = await query('SELECT id, name, email, phone, created_at FROM users WHERE id = ?', [req.user.id]);
    return send(res, 'Profile loaded', users[0]);
  }),
  profile: wrap(async (req, res) => {
    const fields = ['name', 'phone'];
    const updates = fields.filter((field) => req.body[field] !== undefined);
    if (!updates.length) return fail(res, 'No profile fields supplied', 400);
    if (req.body.name !== undefined && (typeof req.body.name !== 'string' || !req.body.name.trim())) return fail(res, 'Name must be a non-empty string', 400);
    if (req.body.phone !== undefined && typeof req.body.phone !== 'string') return fail(res, 'Phone must be a string', 400);
    await query(`UPDATE users SET ${updates.map((field) => `${field} = ?`).join(', ')} WHERE id = ?`, [...updates.map((field) => req.body[field]), req.user.id]);
    const users = await query('SELECT id, name, email, phone FROM users WHERE id = ?', [req.user.id]);
    return send(res, 'Profile updated', users[0]);
  }),
};

const crud = (resource) => ({
  list: wrap(async (req, res) => send(res, `${resource} listed`, await resources.list(resource, req.store?.id, { ...req.query, userId: req.user.id }))),
  get: wrap(async (req, res) => {
    const item = await resources.get(resource, req.store?.id, req.params.id, req.user.id);
    return item ? send(res, `${resource} details`, item) : fail(res, `${resource} not found`, 404);
  }),
  create: wrap(async (req, res) => send(res, `${resource} created`, await resources.create(resource, req.store?.id, req.user.id, req.body), 201)),
  update: wrap(async (req, res) => {
    const item = await resources.update(resource, req.store?.id, req.user.id, req.params.id, req.body);
    return item ? send(res, `${resource} updated`, item) : fail(res, `${resource} not found`, 404);
  }),
  delete: wrap(async (req, res) => {
    const removed = await resources.deactivate(resource, req.store?.id, req.user.id, req.params.id);
    return removed ? send(res, `${resource} deactivated`, null) : fail(res, `${resource} not found`, 404);
  }),
});

const stores = crud('stores');
const categories = crud('categories');
const products = crud('products');
const suppliers = crud('suppliers');
const customers = crud('customers');

customers.profile = wrap(async (req, res) => {
  const rows = await query(
    `SELECT c.*, c.opening_balance + COALESCE(SUM(t.amount), 0) AS balance
     FROM customers c LEFT JOIN customer_transactions t ON t.customer_id = c.id AND t.store_id = c.store_id
     WHERE c.id = ? AND c.store_id = ? GROUP BY c.id`,
    [req.params.id, req.store.id],
  );
  return rows.length ? send(res, 'Customer profile', rows[0]) : fail(res, 'Customer not found', 404);
});

products.barcode = wrap(async (req, res) => {
  const rows = await query('SELECT * FROM products WHERE store_id = ? AND barcode = ? AND is_active = 1', [req.store.id, req.params.barcode]);
  return rows.length ? send(res, 'Product found', rows[0]) : fail(res, 'Product not found', 404);
});

products.get = wrap(async (req, res) => {
  const rows = await query(
    `SELECT p.*, COALESCE(SUM(sb.quantity), 0) AS stock_quantity
     FROM products p LEFT JOIN stock_batches sb ON sb.product_id = p.id AND sb.store_id = p.store_id
     WHERE p.id = ? AND p.store_id = ? GROUP BY p.id`,
    [req.params.id, req.store.id],
  );
  if (!rows.length) return fail(res, 'Product not found', 404);
  const batches = await query(
    'SELECT * FROM stock_batches WHERE product_id = ? AND store_id = ? ORDER BY expiry_date IS NULL, expiry_date, id',
    [req.params.id, req.store.id],
  );
  return send(res, 'Product details', { ...rows[0], batches });
});

customers.transactions = wrap(async (req, res) => {
  const exists = await query('SELECT id FROM customers WHERE id = ? AND store_id = ?', [req.params.id, req.store.id]);
  if (!exists.length) return fail(res, 'Customer not found', 404);
  const { page, limit, offset } = resources.pagination(req.query);
  const [count] = await query('SELECT COUNT(*) AS total FROM customer_transactions WHERE store_id = ? AND customer_id = ?', [req.store.id, req.params.id]);
  const rows = await query('SELECT * FROM customer_transactions WHERE store_id = ? AND customer_id = ? ORDER BY id DESC LIMIT ? OFFSET ?', [req.store.id, req.params.id, limit, offset]);
  return send(res, 'Customer transactions loaded', { items: rows, pagination: { page, limit, total: count[0].total, pages: Math.ceil(count[0].total / limit) } });
});

module.exports = { auth, stores, categories, products, suppliers, customers, crud, wrap, send, fail };
