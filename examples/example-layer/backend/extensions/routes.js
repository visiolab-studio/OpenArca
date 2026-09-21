// `register` mounts routes. Registrars run in REVERSE layer order, so the
// topmost layer registers first and wins a path conflict.
//
// `registerMiddleware` is optional and runs in FORWARD order, so a lower layer's
// concern encloses the higher layer's handlers.
function registerMiddleware({ app }) {
  app.use((req, _res, next) => {
    req.exampleLayerSawRequest = true;
    next();
  });
}

function register({ app, getService }) {
  app.get("/api/example-layer/hello", (_req, res) => {
    res.json({ message: getService("workflowService").exampleLayerGreeting() });
  });
}

module.exports = { register, registerMiddleware };
