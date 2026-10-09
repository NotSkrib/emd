import { isVersionToken } from "../util/json.js";

const VERSIONS_OPEN = "<versions>";
const VERSIONS_CLOSE = "</versions>";

/**
 * Every <version> inside the <versions> block of a maven-metadata.xml, in document order. Values
 * that are not plain version strings are dropped. The block is located with indexOf rather than a
 * lazy regex, which would rescan to the end of the input from every unclosed <versions>.
 */
export function parseMavenVersions(xml: string): string[] {
  const open = xml.indexOf(VERSIONS_OPEN);
  const close = open === -1 ? -1 : xml.indexOf(VERSIONS_CLOSE, open);
  if (close === -1) return [];

  const block = xml.slice(open + VERSIONS_OPEN.length, close);
  return [...block.matchAll(/<version>([^<]+)<\/version>/g)].flatMap((match) => {
    const version = match[1]?.trim();
    return version && isVersionToken(version) ? [version] : [];
  });
}

/** The <release> tag, or <latest> when the repository does not publish one, if it is a plain version string. */
export function parseMavenRelease(xml: string): string | undefined {
  const release = tagValue(xml, "release") ?? tagValue(xml, "latest");
  return release && isVersionToken(release) ? release : undefined;
}

function tagValue(xml: string, tag: string): string | undefined {
  const value = new RegExp(`<${tag}>([^<]+)</${tag}>`).exec(xml)?.[1]?.trim();
  return value ? value : undefined;
}
