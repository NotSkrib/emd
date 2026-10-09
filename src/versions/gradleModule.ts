import { EmdError } from "../errors.js";
import { expectArray, expectRecord, expectVersion, isRecord } from "../util/json.js";
import { compareDotted } from "./compare.js";

const JVM_VERSION = "org.gradle.jvm.version";
const PLUGIN_API_VERSION = "org.gradle.plugin.api-version";
const MIN_JAVA = 8;
const MAX_JAVA = 99;

/** What a published Gradle module says about the Java and Gradle versions it needs. */
export interface ModuleInfo {
  /** The Java version the artifact was compiled for. */
  jvmVersion?: number;
  /** The oldest Gradle a Gradle plugin supports. */
  pluginApiVersion?: string;
}

/**
 * Reads Gradle Module Metadata (the `.module` file next to a Maven artifact). Variants of one
 * module can disagree, for example an API variant without a Gradle requirement next to a runtime
 * variant with one, so the highest value wins: that is what a consumer needs to satisfy.
 */
export function parseGradleModule(json: unknown): ModuleInfo {
  const module = expectRecord(json, "the Gradle module metadata");
  const variants = module.variants === undefined ? [] : expectArray(module.variants, "the module's variants");

  let jvmVersion: number | undefined;
  let pluginApiVersion: string | undefined;
  for (const variant of variants) {
    if (!isRecord(variant) || !isRecord(variant.attributes)) continue;
    const { attributes } = variant;
    if (attributes[JVM_VERSION] !== undefined) {
      const java = parseJavaVersion(attributes[JVM_VERSION]);
      if (jvmVersion === undefined || java > jvmVersion) jvmVersion = java;
    }
    if (attributes[PLUGIN_API_VERSION] !== undefined) {
      const gradle = expectVersion(attributes[PLUGIN_API_VERSION], "the module's Gradle version");
      if (pluginApiVersion === undefined || compareDotted(gradle, pluginApiVersion) > 0) pluginApiVersion = gradle;
    }
  }

  return {
    ...(jvmVersion === undefined ? {} : { jvmVersion }),
    ...(pluginApiVersion === undefined ? {} : { pluginApiVersion }),
  };
}

function parseJavaVersion(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < MIN_JAVA || value > MAX_JAVA) {
    throw new EmdError("BAD_RESPONSE", `Unexpected response: the module's Java version should be a whole number from ${MIN_JAVA} to ${MAX_JAVA}.`);
  }
  return value;
}
