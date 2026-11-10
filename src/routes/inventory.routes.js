const router = require('express').Router();
const { authenticate, requireStore } = require('../middleware/auth.middleware');
const { inventory } = require('../controllers/domain.controller');
const { validateBody } = require('../middleware/validate-body.middleware');
const validate = require('../validators/inventory.validator');

router.use(authenticate, requireStore);
router.get('/low-stock', inventory.list);
router.get('/expiring', inventory.expiring(false));
router.get('/expired', inventory.expiring(true));
router.post('/adjustment', validateBody(validate.adjustment), inventory.adjust);
router.get('/transactions', inventory.transactions);
router.get('/', inventory.list);
router.get('/:productId', inventory.product);

module.exports = router;
