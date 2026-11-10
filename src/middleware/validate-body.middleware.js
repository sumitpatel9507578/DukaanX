const { fail } = require('../utils/response');

function validateBody(validator) {
  return (req, res, next) => {
    const message = validator(req.body || {});
    if (message) return fail(res, message, 400);
    return next();
  };
}

module.exports = { validateBody };
