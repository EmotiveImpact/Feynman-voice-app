// Pick a file of notes from the phone (Files, iCloud Drive, Google Drive,
// OneDrive: whatever the phone's file picker shows) and read it on the server.
// The picker is a native module, so a build made before it was added doesn't
// have it: that build gets a plain message instead of crashing.
import { File } from "expo-file-system";
import { readFile, type ReadFile } from "../api";

export const FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
];

/** About 3 MB, the most the server takes in one go. */
const MAX_BYTES = 3_100_000;

export class PickError extends Error {}

/** null when they cancelled. */
export async function pickAndReadFile(topic?: string): Promise<(ReadFile & { name: string }) | null> {
  let picker: typeof import("expo-document-picker");
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    picker = require("expo-document-picker");
    if (!picker?.getDocumentAsync) throw new Error("missing");
  } catch {
    throw new PickError("Adding files needs the newest Fenny from TestFlight. Update the app, then try again.");
  }
  let res;
  try {
    res = await picker.getDocumentAsync({ type: FILE_TYPES, copyToCacheDirectory: true, multiple: false });
  } catch {
    throw new PickError("Adding files needs the newest Fenny from TestFlight. Update the app, then try again.");
  }
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  if (a.size && a.size > MAX_BYTES) throw new PickError("That file is too big. Try one under 3 MB, or split it.");
  const base64 = await new File(a.uri).base64();
  const read = await readFile(a.name, base64, topic);
  return { ...read, name: a.name };
}
