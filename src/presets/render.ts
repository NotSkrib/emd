import { EmdError } from "../errors.js";
import type { RenderContext } from "./types.js";

/** A token is `{{namespace.key}}` or `{{namespace.key|filter}}`. `\{{` is a literal `{{`. */
const TOKEN_OR_ESCAPE = /\\\{\{|\{\{\s*([a-z]+)\.([A-Za-z0-9]+)(?:\s*\|\s*([a-z]+))?\s*\}\}/g;

type FilterName = "raw" | "java" | "kotlin" | "yaml" | "json" | "xml" | "properties";

const XML_ENTITIES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/** Each filter escapes a value for the inside of a string literal in one language. */
const FILTERS: Readonly<Record<FilterName, (value: string) => string>> = {
  raw: (value) => value,
  java: (value) => value.replace(/[\\"]/g, "\\$&"),
  kotlin: (value) => value.replace(/[\\"$]/g, "\\$&"),
  yaml: (value) => value.replace(/[\\"]/g, "\\$&"),
  json: (value) => JSON.stringify(value).slice(1, -1),
  xml: (value) => value.replace(/[&<>"']/g, (character) => XML_ENTITIES[character] ?? character),
  properties: (value) => value.replace(/\\/g, "\\\\").replace(/^ /, "\\ "),
};

/**
 * Replaces tokens in one pass, so a substituted value is never scanned for further tokens. There is
 * no logic here on purpose. Free-text values must name an escaping filter, which is what stops a
 * description from breaking out of a string in a generated build file.
 */
export function renderTemplate(template: string, context: RenderContext): string {
  if (template.replace(TOKEN_OR_ESCAPE, "").includes("{{")) {
    throw new EmdError("BAD_TEMPLATE", "A template contains a malformed {{token}}. Write a literal {{ as \\{{.");
  }
  return template.replace(
    TOKEN_OR_ESCAPE,
    (match: string, namespace: string | undefined, key: string | undefined, filter: string | undefined) =>
      match.startsWith("\\") ? "{{" : substitute(context, namespace, key, filter),
  );
}

function substitute(context: RenderContext, namespace: string | undefined, key: string | undefined, filterName: string | undefined): string {
  const name = `${namespace}.${key}`;
  const filter = filterName ?? "raw";
  if (!isFilter(filter)) throw new EmdError("BAD_TEMPLATE", `Unknown filter ${JSON.stringify(filter)} in {{${name}}}.`);
  if (filter === "raw" && context.needsFilter.has(name)) {
    throw new EmdError("BAD_TEMPLATE", `{{${name}}} holds free text, so it must use an escaping filter such as {{${name}|json}}.`);
  }
  return FILTERS[filter](lookup(context, namespace, key));
}

function lookup(context: RenderContext, namespace: string | undefined, key: string | undefined): string {
  if (namespace !== "input" && namespace !== "derived" && namespace !== "resolved") {
    throw new EmdError("BAD_TEMPLATE", `Unknown namespace ${JSON.stringify(namespace)}. Use input, derived or resolved.`);
  }
  const scope: Readonly<Record<string, string | boolean>> = context[namespace];
  const value = key !== undefined && Object.hasOwn(scope, key) ? scope[key] : undefined;
  if (value === undefined) {
    throw new EmdError("BAD_TEMPLATE", `{{${namespace}.${key}}} has no value. Check the name, or whether the resolver has this platform for the chosen Minecraft version.`);
  }
  return typeof value === "boolean" ? String(value) : value;
}

function isFilter(name: string): name is FilterName {
  return Object.hasOwn(FILTERS, name);
}
