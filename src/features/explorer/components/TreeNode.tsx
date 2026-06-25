import { useEffect, useRef } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";
import type { Entry } from "../../../shared/types/files";
import { TreeInlineInput, type InlineDraft } from "./TreeInlineInput";

const TREE_BASE_INDENT = 10;
const TREE_DEPTH_INDENT = 8;
const TREE_LOADING_OFFSET = 24;

function comparablePath(path: string) {
  return path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

interface TreeNodeProps {
  entry: Entry;
  depth: number;
  expanded: Set<string>;
  childrenCache: Record<string, Entry[]>;
  loadingPaths: Set<string>;
  selectedFolderPath?: string;
  activeFilePath?: string;
  unsavedFilePathKeys: Set<string>;
  contextPath?: string;
  focusedPath?: string;
  /** Folder path currently highlighted as the active drop target, if any. */
  dropTargetPath?: string | null;
  draft: InlineDraft | null;
  onToggleFolder: (entry: Entry) => Promise<void>;
  onSelectFile: (entry: Entry) => Promise<void>;
  onContextMenu: (entry: Entry, event: ReactMouseEvent) => void;
  onDraftSubmit: (value: string) => void;
  onDraftCancel: () => void;
}

export function TreeNode({
  entry,
  depth,
  expanded,
  childrenCache,
  loadingPaths,
  selectedFolderPath,
  activeFilePath,
  unsavedFilePathKeys,
  contextPath,
  focusedPath,
  dropTargetPath,
  draft,
  onToggleFolder,
  onSelectFile,
  onContextMenu,
  onDraftSubmit,
  onDraftCancel,
}: TreeNodeProps) {
  const rowRef = useRef<HTMLButtonElement | null>(null);
  const isExpanded = expanded.has(entry.path);
  const children = childrenCache[entry.path];
  const isLoading = loadingPaths.has(entry.path);
  const isActiveFile = activeFilePath === entry.path;
  const isUnsavedFile = !entry.is_dir && unsavedFilePathKeys.has(comparablePath(entry.path));
  const isActive = isActiveFile;
  const isContextTarget = contextPath === entry.path;
  const isFocused = focusedPath === entry.path;
  // Highlight a folder row while files are being dragged onto it (the row that
  // will receive the drop). File rows resolve to their parent folder, so they
  // don't show the ring themselves.
  const isDropTarget = entry.is_dir && dropTargetPath != null && dropTargetPath === entry.path;

  const isRenaming = draft?.mode === "rename" && draft.targetPath === entry.path;
  const childDraft =
    draft?.mode === "create" && draft.parentPath === entry.path ? draft : null;

  useEffect(() => {
    if (!isActiveFile) {
      return;
    }

    rowRef.current?.scrollIntoView({
      block: "center",
      inline: "nearest",
    });
  }, [isActiveFile]);

  // Move real DOM focus to the focused row so keyboard shortcuts have a target
  // and the focus ring is visible. Guard against stealing focus from the inline
  // rename/create input, which lives elsewhere in the tree.
  useEffect(() => {
    if (!isFocused) {
      return;
    }
    const active = document.activeElement;
    const editingInline = active?.classList.contains("tree-inline-input");
    if (!editingInline && rowRef.current && active !== rowRef.current) {
      rowRef.current.focus({ preventScroll: true });
    }
  }, [isFocused]);

  if (isRenaming && draft) {
    return (
      <div role="treeitem">
        <TreeInlineInput
          draft={draft}
          depth={depth}
          onSubmit={onDraftSubmit}
          onCancel={onDraftCancel}
        />
      </div>
    );
  }

  return (
    <div role="treeitem" aria-expanded={entry.is_dir ? isExpanded : undefined}>
      <button
        ref={rowRef}
        type="button"
        className={`tree-row ${isActive ? "active" : ""} ${isContextTarget ? "context-target" : ""} ${isUnsavedFile ? "unsaved-file" : ""} ${isDropTarget ? "drop-target" : ""}`}
        style={{ paddingLeft: TREE_BASE_INDENT + depth * TREE_DEPTH_INDENT }}
        tabIndex={isFocused ? 0 : -1}
        data-drop-zone="tree"
        data-drop-path={entry.path}
        data-drop-isdir={entry.is_dir ? "1" : "0"}
        onClick={() =>
          entry.is_dir ? void onToggleFolder(entry) : void onSelectFile(entry)
        }
        onContextMenu={(event) => onContextMenu(entry, event)}
        title={entry.path}
      >
        <span className="tree-chevron">
          {entry.is_dir ? (
            isExpanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )
          ) : null}
        </span>
        {entry.is_dir ? (
          isExpanded ? (
            <FolderOpen size={15} />
          ) : (
            <Folder size={15} />
          )
        ) : (
          <span className="tree-file-icon" aria-hidden="true">
            <FileText size={15} />
          </span>
        )}
        <span className="tree-name">{entry.name}</span>
      </button>

      {entry.is_dir && isExpanded ? (
        <div role="group">
          {childDraft ? (
            <TreeInlineInput
              draft={childDraft}
              depth={depth + 1}
              onSubmit={onDraftSubmit}
              onCancel={onDraftCancel}
            />
          ) : null}
          {isLoading ? (
            <div
              className="tree-loading"
              style={{
                paddingLeft:
                  TREE_BASE_INDENT +
                  TREE_LOADING_OFFSET +
                  depth * TREE_DEPTH_INDENT,
              }}
            >
              Loading...
            </div>
          ) : children && children.length > 0 ? (
            children.map((child) => (
              <TreeNode
                key={child.path}
                entry={child}
                depth={depth + 1}
                expanded={expanded}
                childrenCache={childrenCache}
                loadingPaths={loadingPaths}
                selectedFolderPath={selectedFolderPath}
                activeFilePath={activeFilePath}
                unsavedFilePathKeys={unsavedFilePathKeys}
                contextPath={contextPath}
                focusedPath={focusedPath}
                dropTargetPath={dropTargetPath}
                draft={draft}
                onToggleFolder={onToggleFolder}
                onSelectFile={onSelectFile}
                onContextMenu={onContextMenu}
                onDraftSubmit={onDraftSubmit}
                onDraftCancel={onDraftCancel}
              />
            ))
          ) : children && !childDraft ? (
            <div
              className="tree-loading"
              style={{
                paddingLeft:
                  TREE_BASE_INDENT +
                  TREE_LOADING_OFFSET +
                  depth * TREE_DEPTH_INDENT,
              }}
            >
              Empty
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
