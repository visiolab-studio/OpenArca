function formatZodIssues(issues) {
  return issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code
  }));
}

function validate({ body, query, params }) {
  return (req, res, next) => {
    if (body) {
      const parsedBody = body.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json({ error: "validation_error", details: formatZodIssues(parsedBody.error.issues) });
      }
      req.body = parsedBody.data;
    }

    if (query) {
      const parsedQuery = query.safeParse(req.query);
      if (!parsedQuery.success) {
        return res.status(400).json({ error: "validation_error", details: formatZodIssues(parsedQuery.error.issues) });
      }
      req.query = parsedQuery.data;
    }

    if (params) {
      const parsedParams = params.safeParse(req.params);
      if (!parsedParams.success) {
        return res.status(400).json({ error: "validation_error", details: formatZodIssues(parsedParams.error.issues) });
      }
      req.params = parsedParams.data;
    }

    return next();
  };
}

module.exports = {
  validate
};
