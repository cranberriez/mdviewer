import type { Entry, OpenFile } from "../types/files";

export function parentPath(path: string) {
  const parts = path.split(/[\\/]/);
  parts.pop();
  return parts.join("\\");
}

export function parentName(path: string) {
  return parentPath(path).split(/[\\/]/).pop() ?? "";
}

export function fileName(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

export function fileKind(entry: Entry): OpenFile["kind"] {
  return entry.kind === "md" ? "md" : "text";
}

export function fileKindFromPath(path: string): OpenFile["kind"] {
  const extension = path.split(".").pop()?.toLowerCase();
  return extension === "md" || extension === "markdown" ? "md" : "text";
}

/** Path separator used by the host platform (Windows uses backslashes). */
function pathSeparator(referencePath: string) {
  return referencePath.includes("\\") ? "\\" : "/";
}

/** Join a parent folder path with a child name using the parent's separator. */
export function joinPath(parent: string, child: string) {
  const separator = pathSeparator(parent);
  const trimmed = parent.replace(/[\\/]+$/, "");
  return `${trimmed}${separator}${child}`;
}

/** Extensions the app can read and display in the explorer/preview. */
export const VISIBLE_EXTENSIONS = ["md", "markdown", "txt"] as const;

/** Lowercased extension without the dot, or "" if the name has none. */
export function fileExtension(name: string) {
  const base = name.split(/[\\/]/).pop() ?? name;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) {
    return "";
  }
  return base.slice(dot + 1).toLowerCase();
}

/**
 * True when a file name ends in an extension the app can show. Names without an
 * extension (e.g. plain "notes") are not visible.
 */
export function isVisibleFileName(name: string) {
  return (VISIBLE_EXTENSIONS as readonly string[]).includes(fileExtension(name));
}
