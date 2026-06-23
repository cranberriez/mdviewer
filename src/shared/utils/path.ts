import type { Entry, OpenFile } from "../types/files";

export function parentPath(path: string) {
  const parts = path.split(/[\\/]/);
  parts.pop();
  return parts.join("\\");
}

export function parentName(path: string) {
  return parentPath(path).split(/[\\/]/).pop() ?? "";
}

export function fileKind(entry: Entry): OpenFile["kind"] {
  return entry.kind === "md" ? "md" : "text";
}
