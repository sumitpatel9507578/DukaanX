const express = require('express');
const cors = require('cors');
const { notFound, errorHandler } = require('./middleware/error.middleware');
const { bodyObject } = require('./middleware/validation.middleware');

const app = express();
app.disable('x-powered-by');
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Store-Id'],
}));
app.use(express.json({ limit: '1mb' }));
app.use(bodyObject);

app.get('/health', (req, res) => res.status(200).json({ success: true, message: 'DukaanX API is healthy', data: null }));
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/stores', require('./routes/store.routes'));
app.use('/api/categories', require('./routes/category.routes'));
app.use('/api/products', require('./routes/product.routes'));
app.use('/api/suppliers', require('./routes/supplier.routes'));
app.use('/api/customers', require('./routes/customer.routes'));
app.use('/api/purchases', require('./routes/purchase.routes'));
app.use('/api/sales', require('./routes/sale.routes'));
app.use('/api/inventory', require('./routes/inventory.routes'));
app.use('/api/payments', require('./routes/payment.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes'));
app.use('/api/reports', require('./routes/report.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));
app.use(notFound);
app.use(errorHandler);

module.exports = app;
