import { FileText, FolderInput, AlertTriangle } from "lucide-react";
import type { DropTarget } from "./useFileDrop";

interface MainDropOverlayProps {
  /** The resolved drop target, or null when not hovering the main area. */
  target: DropTarget | null;
  /** Whether the (single) dragged file sits outside the active root. */
  outsideRoot: boolean;
  /** Number of items being dragged (drives multi-file messaging). */
  count: number;
}

/**
 * Full-bleed overlay shown over the content area while an OS file drag hovers
 * it. It only renders its highlighted state when the cursor is actually over a
 * main-area target; otherwise it stays invisible so tree drops aren't obscured.
 *
 * Dropping a file here opens it; dropping a folder makes it the active root.
 * Neither is a copy/move, so no copy/move badge is shown here (that lives on the
 * tree overlay).
 */
export function MainDropOverlay({ target, outsideRoot, count }: MainDropOverlayProps) {
  const isMain = target?.kind === "main-file" || target?.kind === "main-folder";
  if (!isMain) {
    return null;
  }

  const isFolder = target.kind === "main-folder";

  return (
    <div className="main-drop-overlay" role="presentation">
      <div className="main-drop-card">
        <div className="main-drop-icon">{isFolder ? <FolderInput size={26} /> : <FileText size={26} />}</div>
        <div className="main-drop-text">
          <strong>{isFolder ? "Open folder as root" : count > 1 ? "Open first file" : "Open file"}</strong>
          <span>{isFolder ? `“${target.label}” becomes the explorer root` : "Drop to view it here"}</span>
        </div>
        {!isFolder && outsideRoot ? (
          <div className="main-drop-warning">
            <AlertTriangle size={13} />
            <span>Outside the current folder</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
