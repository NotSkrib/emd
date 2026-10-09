import type { AnswerValue, PresetManifest } from "./types.js";

/**
 * One answer per input that has a default or an example, for runs where nobody is typing answers:
 * tests that render every preset, and the script that builds each one. An input with neither is
 * left out, so answer validation reports it instead of the run silently inventing a value.
 */
export function sampleAnswers(manifest: PresetManifest): Record<string, AnswerValue> {
  const entries = manifest.inputs.flatMap((spec) => {
    const value = spec.default ?? spec.example;
    return value === undefined ? [] : [[spec.key, value] as const];
  });
  return Object.fromEntries(entries);
}
