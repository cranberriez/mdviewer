import type { DragItem, DragOrigin, DragRenderHint, DropMode, DropZone } from "./dropTypes";

interface DeriveDropRenderHintOptions {
  origin: DragOrigin;
  items: DragItem[];
  target: DropZone | null;
  mode: DropMode;
  activeRootPath: string | null;
}

function comparablePath(path: string) {
  return path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function containsPath(rootPath: string, path: string) {
  const root = comparablePath(rootPath);
  const child = comparablePath(path);
  return child === root || child.startsWith(`${root}/`);
}

function previewVariant(items: DragItem[]): DragRenderHint["previewVariant"] {
  if (items.length > 1) {
    return "multi";
  }
  return items[0]?.isDir ? "folder" : "file";
}

export function deriveDropRenderHint({
  origin,
  items,
  target,
  mode,
  activeRootPath,
}: DeriveDropRenderHintOptions): DragRenderHint | null {
  if (!target || items.length === 0) {
    return null;
  }

  if (target.kind === "tree-folder" || target.kind === "tree-root") {
    return {
      operation: mode,
      label: target.label,
      warning: null,
      previewVariant: previewVariant(items),
    };
  }

  const first = items[0];
  const isFolder = first.isDir;
  const outsideRoot =
    origin === "external" &&
    !isFolder &&
    activeRootPath != null &&
    !containsPath(activeRootPath, first.path);

  return {
    operation: isFolder ? "set-root" : "open-file",
    label: isFolder ? first.name || first.path : first.name || "file",
    warning: outsideRoot ? "Outside the current folder" : null,
    previewVariant: previewVariant(items),
  };
}
