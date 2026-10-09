export type InputType = "identifier" | "slug" | "package" | "version" | "text" | "url" | "boolean" | "choice";
export type PresetKind = "archetype" | "feature";
export type PresetFamily = "plugin" | "proxy" | "mod" | "pack";
export type ProvenanceUse = "derived" | "reference" | "original";

export type AnswerValue = string | boolean;
export type Answers = Readonly<Record<string, AnswerValue>>;

export interface InputSpec {
  key: string;
  type: InputType;
  label: string;
  /** Used when the caller gives no answer. */
  default?: AnswerValue;
  /** An optional input with no answer and no default is absent, so templates must guard it with `when`. */
  optional?: boolean;
  /** The allowed values of a "choice" input. */
  options?: readonly string[];
  example?: string;
}

/** Holds when the input is truthy, or equal to `equals` when that is given. */
export interface Condition {
  key: string;
  equals?: AnswerValue;
}

export interface FileSpec {
  /** Template path inside the preset folder. */
  from: string;
  /** Output path in the generated project. May contain {{tokens}}. */
  to: string;
  when?: Condition;
}

export interface Provenance {
  use: ProvenanceUse;
  /** "owner/name" of the project the preset came from. Absent for original work. */
  repo?: string;
  commit?: string;
  license: string;
  paths: readonly string[];
}

export interface PresetManifest {
  schema: 1;
  id: string;
  title: string;
  kind: PresetKind;
  family: PresetFamily;
  platforms: readonly string[];
  minecraft: { min?: string; max?: string };
  inputs: readonly InputSpec[];
  files: readonly FileSpec[];
  provenance: readonly Provenance[];
}

export interface RenderContext {
  input: Readonly<Record<string, AnswerValue>>;
  derived: Readonly<Record<string, string>>;
  resolved: Readonly<Record<string, string>>;
  /** Qualified names such as "input.description" whose values are free text and need an escaping filter. */
  needsFilter: ReadonlySet<string>;
}

export interface PlannedFile {
  path: string;
  content: string;
}
