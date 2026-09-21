# Extension layer contract

Status: **accepted** — 2026-09-21
Implements: plan task `P1-T01`. Consumed by `P1-T02` … `P1-T06`.

OpenArca supports stacking several extension bundles on top of the core. This document defines how layers are declared, discovered, ordered and composed. It is the contract that `extension-registry.js`, `routes-extension-loader.js` and `vite.config.js` implement.

## Why this exists

Before this contract, each extension seam had exactly **one slot**: `loadRoutesRegistrar` read one file and returned one function, and `EXTENSIONS_OVERRIDES_FILE` / `ENTERPRISE_FRONTEND_MODULE` were single paths. That permitted exactly one extension bundle. Two bundles — for example a commercial capability pack and a deployment-specific customization — could not be loaded at the same time.

The seams themselves were well chosen; only their arity was wrong.

## Terminology

A **layer** is a directory containing zero or more extension entry points. Layers are ordered. Layer 0 is always the core itself; configured layers stack above it, each able to build on everything below.

The core never knows the name of any specific layer. Prerequisites between layers are declared by the layers themselves (see *Layer manifest*), never hardcoded in core.

## Declaration

A single ordered environment variable:

```bash
EXTENSIONS_LAYERS=../OpenArca-Enterprise,../openarca-edudoro
```

- Comma-separated layer roots, absolute or relative. **Relative paths resolve against the repository root** — the directory containing `backend/` and `frontend/` — so that one value means the same thing to the backend process and to Vite. The legacy single-slot variables keep resolving against `backend/`, as they always did; this is the one place where the two conventions differ, and it is why mixing them is warned about rather than silently honoured.
- Relative entries are for running the app on a host. The containers mount only `backend/` and `frontend/`, so inside them the repository root is not the repository: **containerized deployments mount each layer and use its absolute in-container path**, as the Enterprise override already does.
- **Order is ascending: lowest layer first.** The rightmost entry is the topmost layer and wins conflicts.
- Empty or unset means core-only.
- A configured path that does not exist is a **boot failure**, not a silent skip. A typo in a layer path must not present as "the feature mysteriously isn't there".

Within a layer root, every entry point is optional:

| Path | Purpose |
|---|---|
| `layer.json` | manifest (name, prerequisites) |
| `backend/extensions/service-overrides.js` | service decorators |
| `backend/extensions/routes.js` | Express registrar |
| `backend/extensions/schema.js` | table installation |
| `frontend/extensions/index.jsx` | UI slot contributions |

## Layer manifest

```json
{
  "name": "enterprise",
  "requires": []
}
```

```json
{
  "name": "edudoro",
  "requires": ["enterprise"]
}
```

At boot, core resolves every `requires` entry against the names of layers **below** the declaring layer. A missing or out-of-order prerequisite aborts startup with a message naming both the declaring layer and the absent one.

This is the generic mechanism behind deployment rules such as "the Edudoro layer always ships on top of Enterprise". Core enforces the rule without knowing either name.

A layer without `layer.json` is accepted; its name defaults to its directory basename and it declares no prerequisites.

## Composition rules

The three seams compose in different directions. This is the least obvious part of the contract and the source of the one genuinely hard decision below.

### Services — forward order, decorator chain

Overrides apply from the lowest layer upward. Each function override receives the service **as composed so far**, not the pristine core service:

```
core.ticketService
  → enterprise override receives core's
    → edudoro override receives enterprise's
```

Existing semantics are preserved exactly: an override may be a function `(service) => nextService`, or an object merged over the service. A function returning a non-object is an error naming the offending service and layer.

The previously hardcoded allowlist (`ticketService`, `workflowService`, `taskSyncService`) becomes open: a layer may override any registered service and may register new ones under new names.

### Routes — reverse order, topmost wins

Express matches routes **first-registered-wins**. Registering layers in forward order would therefore mean a lower layer permanently shadows any attempt by a higher layer to replace one of its routes — the opposite of what stacking should mean.

Route registrars are therefore invoked in **reverse layer order**: topmost layer first, core's own routes last.

This ordering is load-bearing, and it constrains the application's own startup: core must invoke the registrars **before** mounting its own routes. Mounting core's routes first would leave a layer able only to add paths, never to intercept one — and intercepting is the point. A layer that screens a core endpoint and then calls `next()` hands the request on to core unchanged, which is how a capability can wrap a core feature instead of reimplementing it. The topmost layer wins any path conflict, which is the behaviour the layer ordering already implies everywhere else.

Middleware does not want that direction. Cross-cutting middleware should wrap in forward order, so that a lower layer's concern encloses the higher layer's handlers. Layers therefore export two optional functions:

```js
module.exports = {
  registerMiddleware(context) { /* forward order: core → enterprise → edudoro */ },
  register(context) { /* reverse order: edudoro → enterprise → core */ }
};
```

Both receive `{ app, ...context }`. A module exporting a bare function, or `{ register }` alone, keeps working and is treated as routes only — this is what the existing Enterprise layer does.

**Rejected alternative: explicit override declarations.** A layer would declare `overrides: ["GET /api/support-threads"]` and core would shadow the lower route. Rejected for two reasons. Express offers no reliable route-removal API, so the implementation would have to reach into router internals and would break on any Express upgrade. More importantly, the declaration duplicates information already present in the route definition itself, and duplicated facts drift: the day the path changes in one place and not the other, the override silently stops applying. Reverse ordering needs no second source of truth.

### Frontend slots — forward order, keyed merge

The four slot arrays (`enterpriseBaseItems`, `enterpriseNavSections`, `enterpriseRoutes`, `enterpriseProfileNotificationSections`) merge from the lowest layer upward.

Merging is **keyed**, not concatenated, so a higher layer can replace an item rather than produce a duplicate next to it. The key for an item is, in order of preference:

1. an explicit `key` field,
2. `to` (its route path) — covers nav items and routes,
3. `labelKey`.

An item with no derivable key is appended and never replaces anything.

Nav **sections** merge by key at the section level, and their `items` merge by the same rule one level down, so a higher layer can add an entry to a section a lower layer defined without redeclaring the section.

Blind concatenation was not considered viable: it makes replacement impossible and turns every customization into a visible duplicate.

### Schema — forward order, after core

Core installs its own tables first, then invokes each layer's `schema.js` from the lowest layer upward. Ordering is load-bearing rather than cosmetic: layer tables carry foreign keys **into lower layers** (Enterprise's `support_threads.converted_ticket_id` references core `tickets`), so a table can only be created once everything it references exists.

Installers must be idempotent — `CREATE TABLE IF NOT EXISTS` and equivalent — because they run on every boot.

## Worked example

```bash
EXTENSIONS_LAYERS=../OpenArca-Enterprise,../openarca-edudoro
```

Resolved stack: `core → enterprise → edudoro`.

| Seam | Invocation order |
|---|---|
| Service overrides | core → enterprise → edudoro |
| Schema installers | core → enterprise → edudoro |
| `registerMiddleware` | core → enterprise → edudoro |
| `register` (routes) | edudoro → enterprise → core |
| Frontend slot merge | core → enterprise → edudoro |

If `edudoro/layer.json` declares `requires: ["enterprise"]` and the Enterprise path is omitted from `EXTENSIONS_LAYERS`, the backend refuses to start:

```
Layer "edudoro" requires layer "enterprise", which is not loaded below it.
Configured layers: core, edudoro
```

## Backward compatibility

The existing single-slot variables keep working and are **not** removed in this change:

- `EXTENSIONS_DIR`
- `EXTENSIONS_OVERRIDES_FILE`
- `EXTENSIONS_ROUTES_FILE`
- `ENTERPRISE_FRONTEND_MODULE`

When `EXTENSIONS_LAYERS` is unset and any legacy variable is set, core synthesizes a single implicit layer from them and logs a one-time deprecation notice naming `EXTENSIONS_LAYERS` as the replacement. When `EXTENSIONS_LAYERS` is set, legacy variables are ignored and a warning says so — silently honouring both would produce a load order nobody can predict from reading the configuration.

An existing Enterprise deployment therefore upgrades without configuration changes, which matters because that deployment is live.

## Naming

`virtual:enterprise-frontend` becomes `virtual:openarca-extensions`. The old specifier remains a working alias. With three layers, "enterprise" is simply the wrong word for the mechanism, and the slot exports keep their current names only to avoid a breaking rename inside the same change — renaming them is follow-up work, not part of this contract.

## Feature flags

Layers continue to gate capabilities through the existing `featureKey` convention and the `requireFeature` backend middleware. Layer membership is not itself an authorization mechanism: a loaded layer may still expose a feature that is switched off. Authorization stays where it is today, in RBAC and `requireFeature`.

## Diagnostics

Core exposes the resolved layer stack — name, path, declared prerequisites, which seams each layer contributed to, and any load error — for the admin readiness view (plan task `P2-T04`).

With one layer, a seam that silently fails to load is an inconvenience. With three, it is the single most likely operational question, so a layer that fails must appear in diagnostics **with its error** rather than be absent from the list.

## Machine identity in extensions

OpenArca supports machine identity for local coding agents — tools that run on a developer's hardware and can read tickets and comment on them. A machine identity is a scope set, never a role. A layer that integrates with agents should read [`machine-identity.md`](./machine-identity.md) before designing endpoints that machines can reach. The key rule is that `requireRole` refuses machines outright, so dangerous endpoints are safe by default; a new endpoint must explicitly scope-check if it wants to allow machines through.
