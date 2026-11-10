const router = require('express').Router();
const { categories } = require('../controllers/api.controller');
const { authenticate, requireStore } = require('../middleware/auth.middleware');
const { validateBody } = require('../middleware/validate-body.middleware');
const validate = require('../validators/category.validator');

router.use(authenticate, requireStore);
router.post('/', validateBody(validate.create), categories.create);
router.get('/', categories.list);
router.get('/:id', categories.get);
router.put('/:id', validateBody((body) => body.name === undefined || (typeof body.name === 'string' && body.name.trim()) ? null : 'Name must be a non-empty string'), categories.update);
router.delete('/:id', categories.delete);

module.exports = router;
