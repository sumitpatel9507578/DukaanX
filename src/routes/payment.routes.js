const router = require('express').Router();
const { authenticate, requireStore } = require('../middleware/auth.middleware');
const { payments } = require('../controllers/domain.controller');
const { validateBody } = require('../middleware/validate-body.middleware');
const validate = require('../validators/payment.validator');

router.use(authenticate, requireStore);
router.post('/', validateBody(validate.create), payments.create);
router.get('/', payments.list);

module.exports = router;
