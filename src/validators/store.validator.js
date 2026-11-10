const { requiredText } = require('./shared.validator');
module.exports = { create: (body) => requiredText(body, ['name']) };
