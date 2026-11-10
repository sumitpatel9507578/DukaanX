const router = require('express').Router();
const { authenticate, requireStore } = require('../middleware/auth.middleware');
const { reports } = require('../controllers/domain.controller');

router.use(authenticate, requireStore);
router.get('/sales', reports.sales);
router.get('/purchases', reports.purchases);
router.get('/profit', reports.profit);
router.get('/stock', reports.stock);
router.get('/expiry', reports.expiry);
router.get('/top-products', reports.topProducts);

module.exports = router;
