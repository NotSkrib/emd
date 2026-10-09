import { describe, expect, it } from "vitest";
import { parseGradleModule } from "../../src/versions/gradleModule.js";
import { errorCodeOf, fixtureJson } from "../helpers/fixtures.js";

const JVM = "org.gradle.jvm.version";
const GRADLE = "org.gradle.plugin.api-version";

const moduleWith = (...variants: Array<Record<string, unknown>>): unknown => ({
  formatVersion: "1.1",
  variants: variants.map((attributes, index) => ({ name: `variant${index}`, attributes })),
});

describe("parseGradleModule", () => {
  it("reads the Java version from the recorded Velocity API module", () => {
    expect(parseGradleModule(fixtureJson("velocity-api-module.json"))).toEqual({ jvmVersion: 25 });
  });

  it("reads the Gradle version a plugin needs", () => {
    expect(parseGradleModule(moduleWith({ [JVM]: 17, [GRADLE]: "9.7.0" }))).toEqual({ jvmVersion: 17, pluginApiVersion: "9.7.0" });
  });

  it("takes the highest value when variants disagree", () => {
    const info = parseGradleModule(moduleWith({ [JVM]: 17 }, { [JVM]: 21, [GRADLE]: "8.14.3" }, { [GRADLE]: "9.1.0" }));

    expect(info).toEqual({ jvmVersion: 21, pluginApiVersion: "9.1.0" });
  });

  it("compares Gradle versions as numbers, not text", () => {
    expect(parseGradleModule(moduleWith({ [GRADLE]: "9.10.0" }, { [GRADLE]: "9.7.0" }))).toEqual({ pluginApiVersion: "9.10.0" });
  });

  it("returns nothing for a module that declares neither, and ignores variants without attributes", () => {
    expect(parseGradleModule(moduleWith({ "org.gradle.usage": "java-api" }))).toEqual({});
    expect(parseGradleModule({ variants: [{ name: "bare" }] })).toEqual({});
    expect(parseGradleModule({})).toEqual({});
  });

  it.each([null, "text", 7, []])("rejects a module that is %j", (value) => {
    expect(errorCodeOf(() => parseGradleModule(value))).toBe("BAD_RESPONSE");
  });

  it("rejects variants that are not a list", () => {
    expect(errorCodeOf(() => parseGradleModule({ variants: "none" }))).toBe("BAD_RESPONSE");
  });

  it.each(["25", 0, -1, 1.5, 7, 1000, null, true])("rejects the Java version %j", (jvm) => {
    expect(errorCodeOf(() => parseGradleModule(moduleWith({ [JVM]: jvm })))).toBe("BAD_RESPONSE");
  });

  it.each([9, "", "9.7.0; rm -rf", "9 7", "../9.7.0", null])("rejects the Gradle version %j", (version) => {
    expect(errorCodeOf(() => parseGradleModule(moduleWith({ [GRADLE]: version })))).toBe("BAD_RESPONSE");
  });
});
