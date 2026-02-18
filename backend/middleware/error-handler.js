const multer = require("multer");

function notFound(req, res) {
  return res.status(404).json({ error: "not_found" });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  let status = Number(err.status || 500);
  let code = err.code || "internal_error";

  if (err instanceof multer.MulterError) {
    status = 400;
    code = "upload_error";
  }

  if (err.message === "unsupported_file_type") {
    status = 400;
    code = "unsupported_file_type";
  }

  const payload = {
    error: code
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
