import { describe, expect, it } from "vitest";
import { compareDotted, isStableMcVersion } from "../../src/versions/compare.js";
import { parseMavenVersions } from "../../src/versions/maven.js";
import { parseFillMcVersions, resolvePaperApi, resolveVelocityApi } from "../../src/versions/paper.js";
import { errorCodeOf, fixtureJson, fixtureText } from "../helpers/fixtures.js";

const METADATA = [
  "26.3.build.8-alpha",
  "26.3.build.9-beta",
  "26.3.build.10-beta",
  "26.3-pre-2.build.0-alpha",
  "26.1.2.build.74-stable",
  "26.1.2.build.70-beta",
  "1.21.11-R0.1-SNAPSHOT",
  "1.21.11-rc1-R0.1-SNAPSHOT",
];

describe("parseFillMcVersions", () => {
  it("flattens the per-major groups and drops pre-releases", () => {
    const json = { versions: { "26.3": ["26.3", "26.3-rc-3"], "1.21": ["1.21.11", "1.21.11-rc1", "1.21"] } };
    expect(parseFillMcVersions(json)).toEqual(["26.3", "1.21.11", "1.21"]);
  });

  it("parses the recorded Paper project", () => {
    const versions = parseFillMcVersions(fixtureJson("fill-paper.json"));
    expect(versions.length).toBeGreaterThan(5);
    expect(versions.every(isStableMcVersion)).toBe(true);
    expect(versions).toEqual([...versions].sort((a, b) => compareDotted(b, a)));
  });

  it("rejects a response without versions", () => {
    expect(errorCodeOf(() => parseFillMcVersions({}))).toBe("BAD_RESPONSE");
  });
});

describe("resolvePaperApi", () => {
  it("uses a dynamic build version for year releases and finds the newest build numerically", () => {
    expect(resolvePaperApi("26.3", METADATA)).toEqual({
      mcVersion: "26.3",
      dependencyVersion: "26.3.build.+",
      latestBuild: "26.3.build.10-beta",
      latestBuildChannel: "beta",
    });
  });

  it("reports the newest stable build separately", () => {
    const result = resolvePaperApi("26.1.2", METADATA);
    expect(result?.dependencyVersion).toBe("26.1.2.build.+");
    expect(result?.latestBuild).toBe("26.1.2.build.74-stable");
    expect(result?.latestStable).toBe("26.1.2.build.74-stable");
  });

  it("does not mistake a pre-release build for the release", () => {
    expect(resolvePaperApi("26.3", ["26.3-pre-2.build.0-alpha"])).toBeUndefined();
  });

  it("uses the pinned SNAPSHOT form before 26.1", () => {
    expect(resolvePaperApi("1.21.11", METADATA)).toEqual({
      mcVersion: "1.21.11",
      dependencyVersion: "1.21.11-R0.1-SNAPSHOT",
      latestBuild: "1.21.11-R0.1-SNAPSHOT",
      latestBuildChannel: "snapshot",
    });
  });

  it.each(["1.99", "26.9"])("returns undefined for %s, which Paper has no API for", (version) => {
    expect(resolvePaperApi(version, METADATA)).toBeUndefined();
  });

  it("resolves the newest recorded release", () => {
    const newest = parseFillMcVersions(fixtureJson("fill-paper.json"))[0];
    const metadata = parseMavenVersions(fixtureText("paper-api-maven-metadata.xml"));
    expect(newest).toBeDefined();
    expect(resolvePaperApi(newest ?? "", metadata)).toBeDefined();
  });
});

describe("resolveVelocityApi", () => {
  it("separates the newest stable API from the newest snapshot", () => {
    const versions = ["3.4.0", "4.0.0-SNAPSHOT", "4.2.0", "4.2.1-SNAPSHOT", "4.1.2-SNAPSHOT"];
    expect(resolveVelocityApi(versions)).toEqual({ stable: "4.2.0", snapshot: "4.2.1-SNAPSHOT" });
  });

  it("omits the snapshot when only releases exist", () => {
    expect(resolveVelocityApi(["3.3.0", "3.4.0"])).toEqual({ stable: "3.4.0" });
  });

  it("returns undefined when there is no stable release", () => {
    expect(resolveVelocityApi(["4.0.0-SNAPSHOT"])).toBeUndefined();
  });

  it("resolves the recorded metadata", () => {
    const versions = parseMavenVersions(fixtureText("velocity-api-maven-metadata.xml"));
    expect(resolveVelocityApi(versions)?.stable).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
