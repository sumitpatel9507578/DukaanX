const { fail } = require('../utils/response');

function bodyObject(req, res, next) {
  if (req.body === undefined) req.body = {};
  if (typeof req.body !== 'object' || Array.isArray(req.body) || req.body === null) {
    return fail(res, 'Request body must be a JSON object', 400);
  }
  return next();
}

function required(fields) {
  return (req, res, next) => {
    const missing = fields.filter((field) => req.body?.[field] === undefined || req.body?.[field] === null);
    if (missing.length) return fail(res, `Missing required fields: ${missing.join(', ')}`, 400);
    return next();
  };
}

module.exports = { bodyObject, required };
