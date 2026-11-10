const { requiredText } = require('./shared.validator');

module.exports = {
  register: (body) => {
    const required = requiredText(body, ['name', 'email', 'password']);
    if (required) return required;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return 'A valid email is required';
    if (body.password.length < 8) return 'Password must be at least 8 characters';
    return null;
  },
  login: (body) => requiredText(body, ['email', 'password']),
  forgotPassword: (body) => requiredText(body, ['email']),
  resetPassword: (body) => {
    const required = requiredText(body, ['token', 'password']);
    return required || (body.password.length < 8 ? 'Password must be at least 8 characters' : null);
  },
};
