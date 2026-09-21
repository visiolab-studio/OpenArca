// Keyed merge for extension UI slots.
//
// Slots merge from the lowest layer upward. Merging is keyed rather than
// concatenated so a higher layer can REPLACE an item a lower layer contributed,
// instead of producing a visible duplicate beside it. An item with no derivable
// key is appended and never replaces anything.
//
// See docs/extensions/layer-contract.md.

export function deriveKey(item) {
  if (!item || typeof item !== "object") return null;
  if (typeof item.key === "string" && item.key) return item.key;
  if (typeof item.to === "string" && item.to) return item.to;
  if (typeof item.labelKey === "string" && item.labelKey) return item.labelKey;
  return null;
}

export function mergeList(lists, mergeItem) {
  const merged = [];
  const positionByKey = new Map();

  for (const list of lists) {
    if (!Array.isArray(list)) continue;

    for (const item of list) {
      const key = deriveKey(item);

      if (key === null) {
        merged.push(item);
        continue;
      }

      if (positionByKey.has(key)) {
        const position = positionByKey.get(key);
        merged[position] = mergeItem ? mergeItem(merged[position], item) : item;
        continue;
      }

      positionByKey.set(key, merged.length);
      merged.push(item);
    }
  }

  return merged;
}

// Nav sections merge one level deeper: a higher layer can add an entry to a
// section a lower layer defined, without redeclaring the whole section.
export function mergeSections(lists) {
  return mergeList(lists, (existing, incoming) => ({
    ...existing,
    ...incoming,
    items: mergeList([existing?.items, incoming?.items])
  }));
}

const NESTED_SLOTS = new Set(["enterpriseNavSections"]);

export function mergeSlot(modules, slotName) {
  const lists = modules.map((module) => module?.[slotName]);
  return NESTED_SLOTS.has(slotName) ? mergeSections(lists) : mergeList(lists);
}
