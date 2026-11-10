const router = require('express').Router();
const { stores } = require('../controllers/api.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { uploadImage } = require('../middleware/upload.middleware');
const { validateBody } = require('../middleware/validate-body.middleware');
const validate = require('../validators/store.validator');

router.use(authenticate);
router.post('/', ...uploadImage(), validateBody(validate.create), stores.create);
router.get('/', stores.list);
router.get('/:id', stores.get);
router.put('/:id', ...uploadImage(), stores.update);
router.delete('/:id', stores.delete);

module.exports = router;
