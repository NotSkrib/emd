export type EmdErrorCode =
  | "BAD_RESPONSE"
  | "BAD_URL"
  | "NETWORK"
  | "HTTP_STATUS"
  | "TOO_LARGE"
  | "UNKNOWN_MC_VERSION"
  | "BAD_PRESET"
  | "BAD_ANSWER"
  | "BAD_TEMPLATE"
  | "NOT_FOUND"
  | "CONFLICT"
  | "USAGE";

export class EmdError extends Error {
  readonly code: EmdErrorCode;

  constructor(code: EmdErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "EmdError";
    this.code = code;
  }
}
