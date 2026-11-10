function requiredText(body, fields) {
  return fields.some((field) => typeof body[field] !== 'string' || !body[field].trim())
    ? `${fields.join(', ')} must be provided`
    : null;
}

function positiveNumber(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

module.exports = { requiredText, positiveNumber };
