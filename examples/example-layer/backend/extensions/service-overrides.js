// Decorates a core service. The function receives the service as composed by the
// layers below this one, so calling through to it keeps their behaviour intact.
module.exports = {
  workflowService(currentService) {
    return {
      ...currentService,
      exampleLayerGreeting() {
        return "hello from the example layer";
      }
    };
  }
};
