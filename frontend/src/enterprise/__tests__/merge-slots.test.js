import { describe, it, expect } from "vitest";
import { deriveKey, mergeList, mergeSections, mergeSlot } from "../merge-slots";

describe("deriveKey", () => {
  it("prefers an explicit key, then a route path, then a label key", () => {
    expect(deriveKey({ key: "a", to: "/b", labelKey: "c" })).toBe("a");
    expect(deriveKey({ to: "/b", labelKey: "c" })).toBe("/b");
    expect(deriveKey({ labelKey: "c" })).toBe("c");
  });

  it("returns null when nothing identifies the item", () => {
    expect(deriveKey({})).toBeNull();
    expect(deriveKey(null)).toBeNull();
  });
});

describe("mergeList", () => {
  it("keeps items from every layer, in layer order", () => {
    const merged = mergeList([[{ to: "/a" }], [{ to: "/b" }]]);
    expect(merged.map((item) => item.to)).toEqual(["/a", "/b"]);
  });

  it("replaces rather than duplicates when a higher layer reuses a key", () => {
    const merged = mergeList([
      [{ to: "/a", label: "lower" }],
      [{ to: "/a", label: "higher" }]
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0].label).toBe("higher");
  });

  it("holds the replaced item's position instead of moving it to the end", () => {
    const merged = mergeList([
      [{ to: "/a" }, { to: "/b" }],
      [{ to: "/a", label: "higher" }]
    ]);

    expect(merged.map((item) => item.to)).toEqual(["/a", "/b"]);
    expect(merged[0].label).toBe("higher");
  });

  it("appends unkeyed items and never lets them replace anything", () => {
    const merged = mergeList([[{}, {}], [{}]]);
    expect(merged).toHaveLength(3);
  });

  it("ignores non-array slots", () => {
    expect(mergeList([undefined, null, [{ to: "/a" }]])).toHaveLength(1);
  });
});

describe("mergeSections", () => {
  it("lets a higher layer add an item to a section the lower layer defined", () => {
    const merged = mergeSections([
      [{ labelKey: "nav.enterprise", items: [{ to: "/threads" }] }],
      [{ labelKey: "nav.enterprise", items: [{ to: "/sylius" }] }]
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0].items.map((item) => item.to)).toEqual(["/threads", "/sylius"]);
  });

  it("replaces an item inside a shared section", () => {
    const merged = mergeSections([
      [{ labelKey: "nav.enterprise", items: [{ to: "/threads", label: "lower" }] }],
      [{ labelKey: "nav.enterprise", items: [{ to: "/threads", label: "higher" }] }]
    ]);

    expect(merged[0].items).toHaveLength(1);
    expect(merged[0].items[0].label).toBe("higher");
  });
});

describe("mergeSlot", () => {
  it("merges nav sections one level deeper than flat slots", () => {
    const lower = {
      enterpriseNavSections: [{ labelKey: "s", items: [{ to: "/a" }] }],
      enterpriseRoutes: [{ to: "/a" }]
    };
    const higher = {
      enterpriseNavSections: [{ labelKey: "s", items: [{ to: "/b" }] }],
      enterpriseRoutes: [{ to: "/b" }]
    };

    expect(mergeSlot([lower, higher], "enterpriseNavSections")[0].items).toHaveLength(2);
    expect(mergeSlot([lower, higher], "enterpriseRoutes")).toHaveLength(2);
  });

  it("returns an empty array when no layers are present", () => {
    expect(mergeSlot([], "enterpriseRoutes")).toEqual([]);
  });
});
