function notFound(req, res) {
  return res.status(404).json({ error: "not_found" });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const status = Number(err.status || 500);
  const payload = {
    error: err.code || "internal_error"
  };

  if (err.details) {
    payload.details = err.details;
  }

  if (process.env.NODE_ENV !== "production") {
    payload.message = err.message;
  }

  return res.status(status).json(payload);
}

module.exports = {
  notFound,
  errorHandler
};
