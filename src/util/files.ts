import { lstat, readFile } from "node:fs/promises";
import { EmdError, type EmdErrorCode } from "../errors.js";

/**
 * Reads a size-limited UTF-8 text file. A missing file, a folder or a link is an error: a link
 * could point the read at something outside the tree being loaded.
 */
export async function readRegularText(file: string, maxBytes: number, label: string, code: EmdErrorCode): Promise<string> {
  const info = await lstat(file).catch((cause: unknown) => {
    throw new EmdError(code, `${label} is missing.`, { cause });
  });
  if (!info.isFile()) throw new EmdError(code, `${label} must be a regular file, not a link or a folder.`);
  if (info.size > maxBytes) throw new EmdError(code, `${label} is larger than ${maxBytes} bytes.`);
  return readFile(file, "utf8");
}
