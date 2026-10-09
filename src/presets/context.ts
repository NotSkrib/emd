import { EmdError } from "../errors.js";
import { isVersionToken } from "../util/json.js";
import type { TargetInfo } from "../versions/resolver.js";
import type { Answers, PresetManifest, RenderContext } from "./types.js";

/** Values computed from the answers, so templates never do string surgery themselves. */
export function deriveValues(answers: Answers): Record<string, string> {
  const packageName = answers.package;
  return typeof packageName === "string" ? { packagePath: packageName.split(".").join("/") } : {};
}

/** The resolver's answer for one Minecraft version, flattened to the names templates use. Missing platforms are simply absent. */
export function resolvedValues(target: TargetInfo): Record<string, string> {
  const entries: Array<[string, string | undefined]> = [
    ["minecraft", target.mcVersion],
    ["java", String(target.java.major)],
    ["gradle", target.tools.gradle],
    ["moddevgradle", target.tools.moddevgradle],
    ["paperApi", target.paper?.dependencyVersion],
    ["velocityApi", target.velocity?.stable],
    ["velocityJava", target.velocity?.java === undefined ? undefined : String(target.velocity.java)],
    ["fabricLoader", target.fabric?.loader],
    ["fabricApi", target.fabric?.api],
    ["loom", target.fabric?.loom],
    ["loomPluginId", target.fabric?.loomPluginId],
    ["neoforge", target.neoforge?.version],
    ["forge", target.forge?.recommended ?? target.forge?.latest],
  ];
  return Object.fromEntries(entries.filter((entry): entry is [string, string] => entry[1] !== undefined));
}

export function buildContext(
  manifest: PresetManifest,
  answers: Answers,
  resolved: Readonly<Record<string, string>>,
): RenderContext {
  const unsafe = Object.entries(resolved)
    .filter(([, value]) => !isVersionToken(value))
    .map(([key]) => key);
  if (unsafe.length > 0) {
    throw new EmdError("BAD_TEMPLATE", `Resolved values must be plain version strings, but these are not: ${unsafe.join(", ")}.`);
  }

  const needsFilter = new Set(
    manifest.inputs.filter((spec) => spec.type === "text" || spec.type === "url").map((spec) => `input.${spec.key}`),
  );
  return { input: answers, derived: deriveValues(answers), resolved, needsFilter };
}
