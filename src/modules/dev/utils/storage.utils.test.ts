import { beforeEach, describe, expect, it } from "vitest";

import { clearStorageEntry, formatBytes, listStorageEntries, resetDemoData } from "./storage.utils";

describe("storage utils", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("ticketera-auth", '{"a":1}');
    localStorage.setItem("otra-app", "x");
    sessionStorage.setItem("ticketera-temp", "ñ");
  });

  it("lists only the app keys with their size", () => {
    expect(listStorageEntries()).toEqual([
      { key: "ticketera-auth", area: "local", value: '{"a":1}', bytes: 7 },
      { key: "ticketera-temp", area: "session", value: "ñ", bytes: 2 },
    ]);
  });

  it("clears one key and resets all the demo data", () => {
    clearStorageEntry("ticketera-temp", "session");
    expect(listStorageEntries().map((entry) => entry.key)).toEqual(["ticketera-auth"]);
    resetDemoData();
    expect(listStorageEntries()).toEqual([]);
    expect(localStorage.getItem("otra-app")).toBe("x");
  });

  it("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
  });
});
