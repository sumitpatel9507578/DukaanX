const router = require('express').Router();
const { authenticate, requireStore } = require('../middleware/auth.middleware');
const { purchases } = require('../controllers/domain.controller');
const { validateBody } = require('../middleware/validate-body.middleware');
const validate = require('../validators/purchase.validator');

router.use(authenticate, requireStore);
router.post('/', validateBody(validate.create), purchases.create);
router.get('/', purchases.list);
router.get('/:id', purchases.get);
router.put('/:id', validateBody(validate.update), purchases.update);
router.delete('/:id', purchases.delete);

module.exports = router;
