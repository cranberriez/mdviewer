import { AlertTriangle, FileText, FolderInput } from "lucide-react";
import type { DragRenderHint, DropZone } from "./dropTypes";

interface MainDropOverlayProps {
  target: DropZone | null;
  hint: DragRenderHint | null;
  count: number;
}

export function MainDropOverlay({ target, hint, count }: MainDropOverlayProps) {
  if (target?.kind !== "main" || !hint) {
    return null;
  }

  const isFolder = hint.operation === "set-root";

  return (
    <div className="main-drop-overlay" role="presentation">
      <div className="main-drop-card">
        <div className="main-drop-icon">{isFolder ? <FolderInput size={26} /> : <FileText size={26} />}</div>
        <div className="main-drop-text">
          <strong>{isFolder ? "Open folder as root" : count > 1 ? "Open first file" : "Open file"}</strong>
          <span>{isFolder ? `"${hint.label}" becomes the explorer root` : "Drop to view it here"}</span>
        </div>
        {hint.warning ? (
          <div className="main-drop-warning">
            <AlertTriangle size={13} />
            <span>{hint.warning}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
