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
        <div
          className="flex gap-0.5 rounded-ctl bg-bg-window p-0.5"
          role="group"
          aria-label="File view mode"
        >
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded-[5px] border-0 bg-transparent px-[11px] py-1 text-xs transition-colors duration-100 hover:text-text-primary ${
              mode === "edit"
                ? "bg-bg-active text-text-primary"
                : "text-text-secondary"
            }`}
            aria-pressed={mode === "edit"}
            onClick={() => onModeChange("edit")}
          >
            <Pencil size={13} />
            Edit
          </button>
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded-[5px] border-0 bg-transparent px-[11px] py-1 text-xs transition-colors duration-100 hover:text-text-primary ${
              mode === "preview"
                ? "bg-bg-active text-text-primary"
                : "text-text-secondary"
            }`}
            aria-pressed={mode === "preview"}
            onClick={() => onModeChange("preview")}
          >
            <Eye size={13} />
            Preview
          </button>
        </div>

        <div className="mx-[3px] h-4 w-px flex-none bg-border-base" />

        <IconActionButton
          tooltip={merged ? "Move bar down" : "Move bar to top"}
          onClick={onToggleMerged}
        >
          {merged ? <ArrowDownToLine size={15} /> : <ArrowUpToLine size={15} />}
        </IconActionButton>
      </div>
    </>
  );
}
