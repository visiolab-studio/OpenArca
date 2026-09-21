const fs = require("fs");
const { extensionsOverridesFile, extensionLayers } = require("../config");
const { createTicketService } = require("./services/ticketService");
const { createWorkflowService } = require("./services/workflowService");
const { createTaskSyncService } = require("./services/taskSyncService");
const { customFieldsService } = require("../services/custom-fields");
const personalData = require("./personal-data");
const db = require("../db");

// Service overrides compose from the lowest layer upward: a function override
// receives the service as composed so far, not the pristine core one.
// See docs/extensions/layer-contract.md.

// Exposed to layers through getService(). A deployment layer configuring its own
// custom fields must go through the validating service, not raw SQL against core
// tables — otherwise it can store values the validation would have refused.
const SERVICE_NAMES = [
  "ticketService",
  "workflowService",
  "taskSyncService",
  "customFieldsService",
  "personalDataService"
];
const DEFAULT_OVERRIDES_FILE = extensionsOverridesFile;

function createCoreServices() {
  return {
    ticketService: createTicketService(),
    workflowService: createWorkflowService(),
    taskSyncService: createTaskSyncService(),
    customFieldsService,
    // Subject access and erasure span core AND every layer, so the aggregation
    // belongs in core while the policy around it — who may run it, what gets
    // logged, how long data is kept — belongs to a compliance layer.
    personalDataService: {
      exportPersonalData: (options) => personalData.exportPersonalData({ db, ...options }),
      erasePersonalData: (options) => personalData.erasePersonalData({ db, ...options })
    }
  };
}

function parseOverridesModule(moduleValue) {
  if (moduleValue && typeof moduleValue === "object") {
    return moduleValue;
  }
  return {};
}

function loadOverridesFromDisk(overridesFilePath = DEFAULT_OVERRIDES_FILE) {
  if (!overridesFilePath || !fs.existsSync(overridesFilePath)) {
    return {};
  }

  const resolvedPath = require.resolve(overridesFilePath);
  delete require.cache[resolvedPath];
  const loaded = require(overridesFilePath);
  return parseOverridesModule(loaded);
}

// `currentService` is undefined when a layer registers a service name core does
// not know. That is allowed: the override then defines the service outright.
function applyOverride(serviceName, currentService, overrideValue, layerName) {
  if (overrideValue == null) {
    return currentService;
  }

  const origin = layerName ? ` (layer "${layerName}")` : "";

  if (typeof overrideValue === "function") {
    const next = overrideValue(currentService);
    if (!next || typeof next !== "object") {
      throw new Error(`Invalid override for ${serviceName}${origin}: function must return object`);
    }
    return next;
  }

  if (typeof overrideValue === "object") {
    return currentService ? { ...currentService, ...overrideValue } : { ...overrideValue };
  }

  throw new Error(`Invalid override for ${serviceName}${origin}: expected object or function`);
}

// Returns { overrides, layerName } entries ordered lowest layer first.
function collectOverrideSets(options) {
  if (Object.prototype.hasOwnProperty.call(options, "overrides") && options.overrides) {
    return [{ overrides: options.overrides, layerName: options.layerName || null }];
  }

  if (options.overridesFilePath) {
    return [
      {
        overrides: loadOverridesFromDisk(options.overridesFilePath),
        layerName: options.layerName || null
      }
    ];
  }

  const layers = options.layers || extensionLayers || [];
  if (layers.length > 0) {
    return layers.map((layer) => ({
      overrides: loadOverridesFromDisk(layer.overridesFile),
      layerName: layer.name
    }));
  }

  return [{ overrides: loadOverridesFromDisk(DEFAULT_OVERRIDES_FILE), layerName: null }];
}

function createServiceRegistry(options = {}) {
  const services = createCoreServices();
  const overrideSets = collectOverrideSets(options);

  // Core names first so listServices() keeps a stable order; names introduced by
  // a layer append in the order the layers declared them.
  const serviceNames = [...SERVICE_NAMES];

  for (const { overrides, layerName } of overrideSets) {
    for (const serviceName of Object.keys(overrides)) {
      if (!serviceNames.includes(serviceName)) {
        serviceNames.push(serviceName);
      }
      services[serviceName] = applyOverride(
        serviceName,
        services[serviceName],
        overrides[serviceName],
        layerName
      );
    }
  }

  return {
    getService(serviceName) {
      const service = services[serviceName];
      if (!service) {
        throw new Error(`Unknown service: ${serviceName}`);
      }
      return service;
    },
    listServices() {
      return [...serviceNames];
    }
  };
}

const defaultRegistry = createServiceRegistry({});

function getService(serviceName) {
  return defaultRegistry.getService(serviceName);
}

function listServices() {
  return defaultRegistry.listServices();
}

module.exports = {
  SERVICE_NAMES,
  createServiceRegistry,
  getService,
  listServices
};
