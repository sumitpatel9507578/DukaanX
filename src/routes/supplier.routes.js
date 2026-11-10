const router = require('express').Router();
const { suppliers } = require('../controllers/api.controller');
const { authenticate, requireStore } = require('../middleware/auth.middleware');
const domain = require('../controllers/domain.controller');
const { validateBody } = require('../middleware/validate-body.middleware');
const validate = require('../validators/supplier.validator');

router.use(authenticate, requireStore);
router.post('/', validateBody(validate.create), suppliers.create);
router.get('/', suppliers.list);
router.get('/:id/balance', domain.supplierBalance);
router.get('/:id', suppliers.get);
router.put('/:id', validateBody((body) => body.name === undefined || (typeof body.name === 'string' && body.name.trim()) ? null : 'Name must be a non-empty string'), suppliers.update);
router.delete('/:id', suppliers.delete);

module.exports = router;
