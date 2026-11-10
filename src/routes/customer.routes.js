const router = require('express').Router();
const { customers } = require('../controllers/api.controller');
const domain = require('../controllers/domain.controller');
const { authenticate, requireStore } = require('../middleware/auth.middleware');
const { validateBody } = require('../middleware/validate-body.middleware');
const validate = require('../validators/customer.validator');

router.use(authenticate, requireStore);
router.get('/:id/balance', domain.customerBalance);
router.get('/:id/transactions', customers.transactions);
router.post('/', validateBody(validate.create), customers.create);
router.get('/', customers.list);
router.get('/:id', customers.profile);
router.put('/:id', validateBody((body) => body.name === undefined || (typeof body.name === 'string' && body.name.trim()) ? null : 'Name must be a non-empty string'), customers.update);
router.delete('/:id', customers.delete);

module.exports = router;
