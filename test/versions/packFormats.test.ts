import { describe, expect, it } from "vitest";
import { parsePackFormats } from "../../src/versions/packFormats.js";
import { errorCodeOf, fixtureJson } from "../helpers/fixtures.js";

const entry = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: "26.3",
  type: "release",
  stable: true,
  data_pack_version: 121,
  data_pack_version_minor: 0,
  resource_pack_version: 97,
  resource_pack_version_minor: 1,
  ...overrides,
});

describe("parsePackFormats", () => {
  it("reads the major and minor format of both pack kinds", () => {
    const formats = parsePackFormats([entry()]);

    expect(formats.get("26.3")).toEqual({ data: { major: 121, minor: 0 }, resource: { major: 97, minor: 1 } });
  });

  it("reads the recorded upstream data", () => {
    const formats = parsePackFormats(fixtureJson("pack-formats.json"));

    expect(formats.size).toBeGreaterThan(3);
    for (const { data, resource } of formats.values()) {
      expect(data.major).toBeGreaterThan(0);
      expect(resource.major).toBeGreaterThan(0);
    }
  });

  it("treats a missing minor version as 0", () => {
    const formats = parsePackFormats([entry({ data_pack_version_minor: undefined, resource_pack_version_minor: undefined })]);

    expect(formats.get("26.3")).toEqual({ data: { major: 121, minor: 0 }, resource: { major: 97, minor: 0 } });
  });

  it("keeps releases only", () => {
    const formats = parsePackFormats([entry(), entry({ id: "26.4-snapshot-1", type: "snapshot" }), entry({ id: "26.4-pre1", stable: false })]);

    expect([...formats.keys()]).toEqual(["26.3"]);
  });

  it("skips a release that has no format, such as a very old one", () => {
    const formats = parsePackFormats([entry(), entry({ id: "1.0", data_pack_version: null, resource_pack_version: null })]);

    expect([...formats.keys()]).toEqual(["26.3"]);
  });

  it("returns an empty map for an empty list", () => {
    expect(parsePackFormats([]).size).toBe(0);
  });

  it.each([null, "text", 7, {}])("rejects a response that is %j instead of a list", (value) => {
    expect(errorCodeOf(() => parsePackFormats(value))).toBe("BAD_RESPONSE");
  });

  it.each([null, "text", 7, []])("rejects an entry that is %j", (value) => {
    expect(errorCodeOf(() => parsePackFormats([value]))).toBe("BAD_RESPONSE");
  });

  it.each(["26.3; rm", "../x", "", "26 3"])("rejects the version id %j", (id) => {
    expect(errorCodeOf(() => parsePackFormats([entry({ id })]))).toBe("BAD_RESPONSE");
  });

  it.each(["121", -1, 1.5, 100001, true])("rejects the data pack format %j", (value) => {
    expect(errorCodeOf(() => parsePackFormats([entry({ data_pack_version: value })]))).toBe("BAD_RESPONSE");
  });

  it.each(["1", -1, 0.5, true])("rejects the resource pack minor format %j", (value) => {
    expect(errorCodeOf(() => parsePackFormats([entry({ resource_pack_version_minor: value })]))).toBe("BAD_RESPONSE");
  });
});
