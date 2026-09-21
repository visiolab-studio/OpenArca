// Slot arrays merge by key across layers. An item whose key matches one from a
// lower layer REPLACES it rather than appearing twice. The key is `key`, else
// `to`, else `labelKey`.
export const enterpriseBaseItems = [];

export const enterpriseNavSections = [
  {
    labelKey: "nav.example",
    items: [{ to: "/example-layer", labelKey: "nav.exampleLayer" }]
  }
];

export const enterpriseRoutes = [];
export const enterpriseProfileNotificationSections = [];

export default {
  enterpriseBaseItems,
  enterpriseNavSections,
  enterpriseRoutes,
  enterpriseProfileNotificationSections
};
