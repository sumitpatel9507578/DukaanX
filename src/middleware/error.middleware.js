function notFound(req, res) {
  res.status(404).json({ success: false, message: 'Route not found', error: null });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = error.code === 'LIMIT_FILE_SIZE' ? 413
    : error.code === 'LIMIT_UNEXPECTED_FILE' ? 400
      : error.code === 'ER_DUP_ENTRY' ? 409
        : Number.isInteger(error.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
  if (process.env.NODE_ENV !== 'test') {
    console.error('API request failed', {
      method: req.method,
      path: req.path,
      code: error.code || 'APPLICATION_ERROR',
      status,
    });
  }
  res.status(status).json({
    success: false,
    message: status === 500 ? 'Internal server error'
      : error.code === 'ER_DUP_ENTRY' ? 'A record with that unique value already exists'
        : error.message,
    error: null,
  });
}

module.exports = { notFound, errorHandler };
