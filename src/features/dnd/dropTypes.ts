import type { PointerEvent as ReactPointerEvent } from "react";

export type DropMode = "move" | "copy";

export type DragOrigin = "internal" | "external";

export type DragItem = {
  path: string;
  name: string;
  isDir: boolean;
};

export type DropZoneKind = "tree-folder" | "tree-root" | "main" | "home";

export type DropOperation = "move" | "copy" | "open-file" | "set-root";

export type DropZone = {
  kind: DropZoneKind;
  destDir: string;
  label: string;
};

export type DragRenderHint = {
  operation: DropOperation;
  label: string;
  warning: string | null;
  previewVariant: "file" | "folder" | "multi";
};

export type DragPointer = {
  x: number;
  y: number;
};

export type DragSessionState = {
  active: boolean;
  origin: DragOrigin;
  items: DragItem[];
  pointer: DragPointer | null;
  target: DropZone | null;
  mode: DropMode;
  renderHint: DragRenderHint | null;
  activeRootPath: string | null;
  escalatedToNative: boolean;
};

export type InternalDragState = DragSessionState & {
  origin: "internal";
};

export type ExternalDropState = DragSessionState & {
  origin: "external";
};

export type InternalDragStart = (items: DragItem[], event: ReactPointerEvent) => void;

export type DropDispatcher = (target: DropZone | null, items: DragItem[], mode: DropMode) => void;

export const DROP_ZONE_ATTR = "data-drop-zone";

export const EMPTY_EXTERNAL_DROP_STATE: ExternalDropState = {
  active: false,
  origin: "external",
  items: [],
  pointer: null,
  target: null,
  mode: "move",
  renderHint: null,
  activeRootPath: null,
  escalatedToNative: false,
};

export const EMPTY_INTERNAL_DRAG_STATE: InternalDragState = {
  active: false,
  origin: "internal",
  items: [],
  pointer: null,
  target: null,
  mode: "move",
  renderHint: null,
  activeRootPath: null,
  escalatedToNative: false,
};

export function resolveDropMode(shiftHeld: boolean): DropMode {
  const defaultMode: DropMode = "move";
  return shiftHeld ? (defaultMode === "move" ? "copy" : "move") : defaultMode;
}
