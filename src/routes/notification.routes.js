const router = require('express').Router();
const { authenticate, requireStore } = require('../middleware/auth.middleware');
const { notifications } = require('../controllers/domain.controller');

router.use(authenticate, requireStore);
router.put('/read-all', notifications.readAll);
router.get('/', notifications.list);
router.put('/:id/read', notifications.read);

module.exports = router;
