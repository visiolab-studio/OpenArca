const jwt = require("jsonwebtoken");
const db = require("../db");
const { jwtSecret } = require("../config");

function authRequired(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = db
      .prepare(
        `SELECT
          id, email, name, role, language, avatar_filename, avatar_updated_at, created_at, last_login
         FROM users
         WHERE id = ?`
      )
      .get(payload.sub);

    if (!user) {
      return res.status(401).json({ error: "unauthorized" });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ error: "unauthorized" });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "unauthorized" });
    }
    if (req.user.role !== role) {
      return res.status(403).json({ error: "forbidden" });
    }
    return next();
  };
}

module.exports = {
  authRequired,
  requireRole
};
