import { useEffect, useRef } from "react";
import { FileText, Folder } from "lucide-react";

export type InlineDraftKind = "file" | "folder";

export interface InlineDraft {
  /** Where the new entry/rename input lives (parent folder path for creation). */
  parentPath: string;
  mode: "create" | "rename";
  kind: InlineDraftKind;
  /** Initial text for the input. */
  initialValue: string;
  /**
   * Selection to apply on focus. "start" places the caret before the first
   * character (used for new files so the suggested ".md" stays visible).
   * "name" selects the base name without its extension (used for rename).
   */
  selection: "start" | "name" | "all";
  /** For rename: the path being renamed. */
  targetPath?: string;
}

const TREE_BASE_INDENT = 10;
const TREE_DEPTH_INDENT = 8;

interface TreeInlineInputProps {
  draft: InlineDraft;
  depth: number;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

function applySelection(input: HTMLInputElement, selection: InlineDraft["selection"]) {
  const value = input.value;
  if (selection === "start") {
    input.setSelectionRange(0, 0);
    return;
  }
  if (selection === "all") {
    input.setSelectionRange(0, value.length);
    return;
  }
  // "name": select the base name, leaving the extension unselected.
  const dot = value.lastIndexOf(".");
  const end = dot > 0 ? dot : value.length;
  input.setSelectionRange(0, end);
}

export function TreeInlineInput({ draft, depth, onSubmit, onCancel }: TreeInlineInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    input.focus();
    applySelection(input, draft.selection);
    // Only run when a new draft begins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.parentPath, draft.mode, draft.kind, draft.targetPath]);

  const Icon = draft.kind === "folder" ? Folder : FileText;

  return (
    <div
      className="tree-inline-row"
      style={{ paddingLeft: TREE_BASE_INDENT + depth * TREE_DEPTH_INDENT }}
    >
      <span className="tree-chevron" aria-hidden="true" />
      <Icon size={15} />
      <input
        ref={inputRef}
        className="tree-inline-input"
        defaultValue={draft.initialValue}
        spellCheck={false}
        autoComplete="off"
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSubmit(event.currentTarget.value);
          } else if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        onBlur={(event) => onSubmit(event.currentTarget.value)}
      />
    </div>
  );
}
