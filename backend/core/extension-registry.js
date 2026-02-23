const fs = require("fs");
const { extensionsOverridesFile } = require("../config");
const { createTicketService } = require("./services/ticketService");
const { createWorkflowService } = require("./services/workflowService");
const { createTaskSyncService } = require("./services/taskSyncService");

const SERVICE_NAMES = ["ticketService", "workflowService", "taskSyncService"];
const DEFAULT_OVERRIDES_FILE = extensionsOverridesFile;

function createCoreServices() {
  return {
    ticketService: createTicketService(),
    workflowService: createWorkflowService(),
    taskSyncService: createTaskSyncService()
  };
}

function parseOverridesModule(moduleValue) {
  if (moduleValue && typeof moduleValue === "object") {
    return moduleValue;
  }
  return {};
}

function loadOverridesFromDisk(overridesFilePath = DEFAULT_OVERRIDES_FILE) {
  if (!fs.existsSync(overridesFilePath)) {
    return {};
  }

  const resolvedPath = require.resolve(overridesFilePath);
  delete require.cache[resolvedPath];
  const loaded = require(overridesFilePath);
  return parseOverridesModule(loaded);
}

function applyOverride(serviceName, coreService, overrideValue) {
  if (overrideValue == null) {
    return coreService;
  }

  if (typeof overrideValue === "function") {
    const next = overrideValue(coreService);
    if (!next || typeof next !== "object") {
      throw new Error(`Invalid override for ${serviceName}: function must return object`);
    }
    return next;
  }

  if (typeof overrideValue === "object") {
    return {
      ...coreService,
      ...overrideValue
    };
  }

  throw new Error(`Invalid override for ${serviceName}: expected object or function`);
}

function createServiceRegistry(options = {}) {
  const coreServices = createCoreServices();
  const overrides =
    Object.prototype.hasOwnProperty.call(options, "overrides") && options.overrides
      ? options.overrides
      : loadOverridesFromDisk(options.overridesFilePath);
  const services = {};

  for (const serviceName of SERVICE_NAMES) {
    const coreService = coreServices[serviceName];
    services[serviceName] = applyOverride(serviceName, coreService, overrides[serviceName]);
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
      return [...SERVICE_NAMES];
    }
  };
}

const defaultRegistry = createServiceRegistry({
  overridesFilePath: DEFAULT_OVERRIDES_FILE
});

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
