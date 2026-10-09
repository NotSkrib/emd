import { expectRecord, expectVersion } from "../util/json.js";

/** Current Gradle release from services.gradle.org/versions/current. */
export function parseGradleVersion(json: unknown): string {
  return expectVersion(expectRecord(json, "the Gradle version response").version, "the Gradle version");
}
