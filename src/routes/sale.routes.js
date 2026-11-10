const router = require('express').Router();
const { authenticate, requireStore } = require('../middleware/auth.middleware');
const { sales } = require('../controllers/domain.controller');
const { validateBody } = require('../middleware/validate-body.middleware');
const validate = require('../validators/sale.validator');

router.use(authenticate, requireStore);
router.post('/', validateBody(validate.create), sales.create);
router.get('/', sales.list);
router.get('/:id', sales.get);
router.put('/:id', validateBody(validate.update), sales.update);
router.post('/:id/return', validateBody(validate.return), sales.return);

module.exports = router;
