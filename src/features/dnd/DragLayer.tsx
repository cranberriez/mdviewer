import { Ban, Copy, FileText, Folder, MousePointer2, Plus } from "lucide-react";
import type { InternalDragState } from "./dropTypes";

interface DragLayerProps {
  state: InternalDragState;
}

function operationLabel(state: InternalDragState) {
  const hint = state.renderHint;
  if (!hint) {
    return "";
  }

  if (hint.operation === "move") {
    return `Move to ${hint.label}`;
  }
  if (hint.operation === "copy") {
    return `Copy to ${hint.label}`;
  }
  if (hint.operation === "set-root") {
    return `Open ${hint.label} as root`;
  }
  if (hint.operation === "open-file") {
    return state.items.length > 1 ? `Open ${hint.label}` : "Open file";
  }
  return hint.label;
}

export function DragLayer({ state }: DragLayerProps) {
  if (!state.active || state.escalatedToNative || !state.pointer || state.items.length === 0) {
    return null;
  }

  const first = state.items[0];
  const hint = state.renderHint;
  const variant = hint?.previewVariant ?? (first.isDir ? "folder" : "file");
  const Icon =
    hint?.operation === "blocked"
      ? Ban
      : variant === "folder"
        ? Folder
        : variant === "multi"
          ? Copy
          : FileText;
  const actionIcon =
    hint?.operation === "copy" ? (
      <Plus size={12} />
    ) : hint?.operation === "blocked" ? (
      <Ban size={12} />
    ) : (
      <MousePointer2 size={12} />
    );

  return (
    <div
      className={`drag-layer ${hint?.operation ?? "move"}`}
      style={{ transform: `translate3d(${state.pointer.x + 12}px, ${state.pointer.y + 10}px, 0)` }}
      aria-hidden="true"
    >
      <div className="drag-layer-icon">
        <Icon size={16} />
      </div>
      <div className="drag-layer-copy">
        <strong>{state.items.length > 1 ? `${state.items.length} items` : first.name}</strong>
        <span>
          {actionIcon}
          {operationLabel(state)}
        </span>
      </div>
    </div>
  );
}
