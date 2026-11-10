const router = require('express').Router();
const { authenticate, requireStore } = require('../middleware/auth.middleware');
const { dashboard } = require('../controllers/domain.controller');

router.use(authenticate, requireStore);
router.get('/alerts', dashboard.alerts);
router.get('/', dashboard.summary);

module.exports = router;
