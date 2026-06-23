import {
  ArrowDownToLine,
  ArrowUpToLine,
  Eye,
  Pencil,
  Save,
  Search,
} from "lucide-react";
import { IconActionButton } from "./IconActionButton";

export type FileViewMode = "edit" | "preview";

interface FileActionControlsProps {
  dirty: boolean;
  findOpen: boolean;
  merged: boolean;
  mode: FileViewMode;
  onModeChange: (mode: FileViewMode) => void;
  onSave: () => void;
  onToggleFind: () => void;
  onToggleMerged: () => void;
  saving: boolean;
}

export function FileActionControls({
  dirty,
  findOpen,
  merged,
  mode,
  onModeChange,
  onSave,
  onToggleFind,
  onToggleMerged,
  saving,
}: FileActionControlsProps) {
  return (
    <>
      <div className="flex items-center gap-0.5">
        <IconActionButton
          className={dirty ? "text-text-primary" : ""}
          disabled={saving}
          tooltip={saving ? "Saving" : "Save"}
          onClick={onSave}
        >
          <span
            className={`absolute right-[5px] top-[5px] h-[5px] w-[5px] rounded-full transition-colors duration-100 ${
              dirty ? "bg-text-secondary" : "bg-transparent"
            }`}
            aria-hidden="true"
          />
          <Save size={15} />
        </IconActionButton>

        <IconActionButton
          active={findOpen}
          tooltip={findOpen ? "Close find" : "Find"}
          onClick={onToggleFind}
        >
          <Search size={15} />
        </IconActionButton>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-0.5">
        <IconActionButton
          tooltip={merged ? "Move bar down" : "Move bar to top"}
          onClick={onToggleMerged}
        >
          {merged ? <ArrowDownToLine size={15} /> : <ArrowUpToLine size={15} />}
        </IconActionButton>

        <div
          className="view-mode-toggle"
          role="group"
          aria-label="File view mode"
        >
          <button
            type="button"
            className={`view-mode-toggle-button ${mode === "edit" ? "active" : ""}`}
            aria-label="Edit"
            aria-pressed={mode === "edit"}
            title="Edit"
            onClick={() => onModeChange("edit")}
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            className={`view-mode-toggle-button ${
              mode === "preview" ? "active" : ""
            }`}
            aria-label="Preview"
            aria-pressed={mode === "preview"}
            title="Preview"
            onClick={() => onModeChange("preview")}
          >
            <Eye size={14} />
          </button>
        </div>
      </div>
    </>
  );
}
