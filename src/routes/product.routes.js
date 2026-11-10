const router = require('express').Router();
const { products } = require('../controllers/api.controller');
const { authenticate, requireStore } = require('../middleware/auth.middleware');
const { uploadImage } = require('../middleware/upload.middleware');
const { validateBody } = require('../middleware/validate-body.middleware');
const validate = require('../validators/product.validator');

router.use(authenticate, requireStore);
router.get('/barcode/:barcode', products.barcode);
router.post('/', ...uploadImage(), validateBody(validate.create), products.create);
router.get('/', products.list);
router.get('/:id', products.get);
router.put('/:id', ...uploadImage(), validateBody(validate.update), products.update);
router.delete('/:id', products.delete);

module.exports = router;
