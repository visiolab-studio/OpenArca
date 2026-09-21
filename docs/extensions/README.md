# Building an extension layer

OpenArca can load several extension layers on top of the core, each building on the one below. A layer is a directory — usually its own repository — that the core mounts read-only and loads at boot. No forking, no patching core files.

This page is the practical guide. [`layer-contract.md`](./layer-contract.md) is the precise specification.

A complete, runnable example lives in [`examples/example-layer/`](../../examples/example-layer). Everything below is taken from it.

## 1. Create the directory

```
my-layer/
  layer.json
  backend/extensions/service-overrides.js
  backend/extensions/routes.js
  backend/extensions/schema.js
  frontend/extensions/index.jsx
```

Every file is optional. A layer that only adds a nav item needs nothing but `frontend/extensions/index.jsx`.

## 2. Declare the layer

```json
{
  "name": "my-layer",
  "requires": []
}
```

`requires` names layers that must be loaded **below** this one. If one is missing, the backend refuses to start and says which layer is absent — rather than booting with a feature quietly missing. Without `layer.json`, the layer takes its directory name and declares no prerequisites.

## 3. Load it

```bash
EXTENSIONS_LAYERS=../my-layer
```

Comma-separated, **lowest layer first**. Relative paths resolve against the repository root — the directory holding `backend/` and `frontend/`. The rightmost entry is the topmost layer and wins conflicts.

```bash
EXTENSIONS_LAYERS=../OpenArca-Enterprise,../my-layer
```

A path that does not exist aborts the boot. That is deliberate: a typo should not present as a feature mysteriously not being there.

## 4. Extend the backend

### Decorate a service

```js
module.exports = {
  workflowService(currentService) {
    return { ...currentService, myMethod() { return "..."; } };
  }
};
```

`currentService` is the service **as composed by the layers below you** — not the pristine core one. Calling through to it keeps their behaviour intact. An object export is merged over the service instead.

You may also register a service name core does not know; it becomes available to every layer above you through `getService()`.

### Add routes

```js
function register({ app, getService, db, middlewares }) {
  app.get("/api/my-layer/thing", (_req, res) => res.json({ ok: true }));
}

module.exports = { register };
```

Registrars receive `{ app, express, db, appUrl, uploadsDir, getService, sendEmail, middlewares }`.

**Ordering.** Express matches first-registered-wins, so `register` runs in **reverse** layer order: the topmost layer registers first and therefore wins a path conflict. If you want to enclose lower layers rather than override them, export `registerMiddleware` instead — it runs in forward order.

### Add tables

```js
function install(db) {
  db.prepare(`CREATE TABLE IF NOT EXISTS my_table (...)`).run();
}

module.exports = { install };
```

Installers run after core's migration and after every lower layer's, so referencing their tables with foreign keys is safe. They run on **every boot**, so they must be idempotent.

Do not create tables lazily inside a route registrar. Registrars run in reverse order, so a layer above you may execute before you do.

### Dependencies

Use **Node built-ins and your own files only**. A layer is mounted outside the
core application directory, so Node cannot resolve core's `node_modules` from it:
`require("uuid")` in a layer fails at boot, while `require("node:crypto")` works.

If a layer genuinely needs a third-party package, it has to ship its own
`node_modules` inside the mounted directory. The bundled example layer and the
Enterprise layer both stick to built-ins.

### Declare personal data

If a layer stores anything about a person, it declares that surface so subject
access and erasure can reach it. Core cannot guess at a layer's schema.

```js
// backend/extensions/personal-data.js
module.exports = {
  export({ db, subject }) {
    return db.prepare('SELECT * FROM my_table WHERE user_id = ?').all(subject.id);
  },
  erase({ db, subject }) {
    db.prepare('UPDATE my_table SET body = ? WHERE user_id = ?').run('[erased]', subject.id);
    return { anonymised: true };
  }
};
```

Either function may be omitted, and a layer with no personal data omits the file
entirely — requiring every layer to declare an empty module would be ceremony
nobody keeps up to date.

**Erasure runs layers first, then core.** Layer tables carry foreign keys into
core, so clearing core's user row first could break them or cascade away rows the
layer meant to anonymise itself.

Prefer anonymising over deleting wherever a record has operational meaning. A
ticket that vanishes takes its history with it, and the team still needs to know
the work happened.

## 5. Extend the frontend

```jsx
export const enterpriseNavSections = [
  { labelKey: "nav.example", items: [{ to: "/my-layer", labelKey: "nav.myThing" }] }
];
export const enterpriseBaseItems = [];
export const enterpriseRoutes = [];
export const enterpriseProfileNotificationSections = [];
```

Slots merge by key, not by concatenation. An item whose key matches one from a lower layer **replaces** it rather than appearing twice. The key is `key`, else `to`, else `labelKey`; an item with none of those is appended and never replaces anything. Nav sections merge one level deeper, so you can add an entry to a section a lower layer declared without redeclaring it.

The export names still say `enterprise` for historical reasons. They are ordinary slot names and apply to any layer.

## Running the example

```bash
docker compose -f docker-compose.yml -f docker-compose.example-layer.override.yml up --build
curl http://localhost:4000/api/example-layer/hello
# {"message":"hello from the example layer"}
```

That override shows the deployment pattern for every layer: mount the layer into both containers and point `EXTENSIONS_LAYERS` at its **in-container absolute path**.

This matters more than it looks. The containers mount only `backend/` and `frontend/`, so inside them the "repository root" that relative entries resolve against is not the repository. Relative paths are for running the app directly on a host; deployments use absolute paths, which is what the Enterprise override has always done.

## Migrating from the single-slot variables

`EXTENSIONS_DIR`, `EXTENSIONS_OVERRIDES_FILE`, `EXTENSIONS_ROUTES_FILE` and `ENTERPRISE_FRONTEND_MODULE` still work and describe one implicit layer, so existing deployments upgrade without configuration changes.

They cannot express more than one layer. To stack layers, replace them with `EXTENSIONS_LAYERS` pointing at layer **roots** rather than individual files:

```diff
- EXTENSIONS_OVERRIDES_FILE=/opt/openarca-enterprise/backend/extensions/service-overrides.js
- EXTENSIONS_ROUTES_FILE=/opt/openarca-enterprise/backend/extensions/routes.js
- ENTERPRISE_FRONTEND_MODULE=/opt/openarca-enterprise/frontend/extensions/index.jsx
+ EXTENSIONS_LAYERS=/opt/openarca-enterprise
```

Setting both is not an error, but `EXTENSIONS_LAYERS` wins and a warning says so. Honouring both would produce a load order nobody could read off the configuration.

One behavioural difference worth knowing: relative paths in the legacy variables resolve against `backend/`, while relative entries in `EXTENSIONS_LAYERS` resolve against the repository root, so that one value means the same thing to the backend and to Vite.

## Production deployment

`docker-compose.yml` is a **development** stack: it runs the Vite dev server and
nodemon, and bind-mounts the source. Do not expose it.

`docker-compose.prod.yml` builds `Dockerfile.prod` for both services: the SPA is
compiled and served as static files, the backend runs `node server.js` with
production dependencies only, ports bind to `127.0.0.1` behind a reverse proxy,
and SQLite lives on a named volume rather than a path inside the deploy
directory — a redeploy that replaces that directory would otherwise take the
database with it.

Layers are mounted into both containers and referenced by their absolute
in-container path, exactly as in development.
