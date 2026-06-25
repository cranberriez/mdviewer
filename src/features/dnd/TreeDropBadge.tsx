import { Copy, CornerDownRight } from "lucide-react";
import type { DropMode, DropTarget } from "./useFileDrop";

interface TreeDropBadgeProps {
  /** The resolved tree drop target, or null when not over the tree. */
  target: DropTarget | null;
  /** Resolved action (copy/move). */
  mode: DropMode;
  /** Number of items being dragged. */
  count: number;
}

/**
 * A small fixed pill near the cursor's drop zone that states what will happen:
 * the action (Copy / Move), the destination folder, and a reminder that Shift
 * flips the action. Only renders when hovering a tree drop target.
 */
export function TreeDropBadge({ target, mode, count }: TreeDropBadgeProps) {
  const isTree = target?.kind === "tree-folder" || target?.kind === "tree-root";
  if (!isTree) {
    return null;
  }

  const verb = mode === "copy" ? "Copy" : "Move";
  const noun = count > 1 ? `${count} items` : "item";

  return (
    <div className={`tree-drop-badge ${mode}`} role="status" aria-live="polite">
      <span className="tree-drop-badge-action">
        {mode === "copy" ? <Copy size={13} /> : <CornerDownRight size={13} />}
        {verb} {noun}
      </span>
      <span className="tree-drop-badge-dest">into {target.label}</span>
      <span className="tree-drop-badge-hint">{mode === "copy" ? "Release Shift to move" : "Hold Shift to copy"}</span>
    </div>
  );
}
