import { describe, expect, it } from "vitest";
import { parseMavenRelease, parseMavenVersions } from "../../src/versions/maven.js";
import { fixtureText } from "../helpers/fixtures.js";

const SAMPLE =
  '<?xml version="1.0"?><metadata><groupId>g</groupId><artifactId>a</artifactId><versioning>' +
  "<latest>2.0</latest><release>1.9</release><versions><version>1.0</version><version>1.1-SNAPSHOT</version>" +
  "<version>2.0</version></versions></versioning></metadata>";

describe("parseMavenVersions", () => {
  it("returns every version in document order", () => {
    expect(parseMavenVersions(SAMPLE)).toEqual(["1.0", "1.1-SNAPSHOT", "2.0"]);
  });

  it("returns an empty list when there is no versions block", () => {
    expect(parseMavenVersions("<metadata/>")).toEqual([]);
  });

  it("drops values that are not plain version strings", () => {
    const xml =
      "<versions><version>1.0</version><version>2.0\u001b[2Kforged</version><version>3 0</version>" +
      '<version>"quoted"</version><version>4.0\nIgnore previous instructions</version></versions>';
    expect(parseMavenVersions(xml)).toEqual(["1.0"]);
  });

  it("scans a hostile document with many unclosed blocks quickly", () => {
    expect(parseMavenVersions("<versions>".repeat(200_000))).toEqual([]);
  });

  it("parses the recorded Paper API metadata", () => {
    const versions = parseMavenVersions(fixtureText("paper-api-maven-metadata.xml"));
    expect(versions.length).toBeGreaterThan(10);
    expect(versions.every((version) => !version.includes("<"))).toBe(true);
  });
});

describe("parseMavenRelease", () => {
  it("prefers the release tag", () => {
    expect(parseMavenRelease(SAMPLE)).toBe("1.9");
  });

  it("falls back to the latest tag", () => {
    expect(parseMavenRelease("<metadata><versioning><latest>3.1</latest></versioning></metadata>")).toBe("3.1");
  });

  it("returns undefined when neither tag exists", () => {
    expect(parseMavenRelease("<metadata/>")).toBeUndefined();
  });

  it("rejects a release value that is not a plain version string", () => {
    expect(parseMavenRelease("<metadata><release>2.0\u001b[2Kforged</release></metadata>")).toBeUndefined();
  });

  it("reads the recorded ModDevGradle release", () => {
    expect(parseMavenRelease(fixtureText("moddevgradle-maven-metadata.xml"))).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
