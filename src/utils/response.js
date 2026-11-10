function success(res, message, data, status = 200) {
  return res.status(status).json({ success: true, message, data });
}

function fail(res, message, status = 400, error = null) {
  return res.status(status).json({ success: false, message, error });
}

module.exports = { success, fail };
