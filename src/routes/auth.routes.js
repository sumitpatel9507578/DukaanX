const router = require('express').Router();
const { auth } = require('../controllers/api.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validateBody } = require('../middleware/validate-body.middleware');
const validate = require('../validators/auth.validator');

router.post('/register', validateBody(validate.register), auth.register);
router.post('/login', validateBody(validate.login), auth.login);
router.post('/forgot-password', validateBody(validate.forgotPassword), auth.forgotPassword);
router.post('/reset-password', validateBody(validate.resetPassword), auth.resetPassword);
router.get('/me', authenticate, auth.me);
router.put('/profile', authenticate, auth.profile);

module.exports = router;
