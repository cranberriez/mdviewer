import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";
import type { Entry } from "../../../shared/types/files";

const TREE_BASE_INDENT = 10;
const TREE_DEPTH_INDENT = 8;
const TREE_LOADING_OFFSET = 24;

interface TreeNodeProps {
  entry: Entry;
  depth: number;
  expanded: Set<string>;
  childrenCache: Record<string, Entry[]>;
  loadingPaths: Set<string>;
  selectedFolderPath?: string;
  activeFilePath?: string;
  onToggleFolder: (entry: Entry) => Promise<void>;
  onSelectFile: (entry: Entry) => Promise<void>;
}

export function TreeNode({
  entry,
  depth,
  expanded,
  childrenCache,
  loadingPaths,
  selectedFolderPath,
  activeFilePath,
  onToggleFolder,
  onSelectFile,
}: TreeNodeProps) {
  const isExpanded = expanded.has(entry.path);
  const children = childrenCache[entry.path];
  const isLoading = loadingPaths.has(entry.path);
  const isActive = entry.is_dir
    ? selectedFolderPath === entry.path
    : activeFilePath === entry.path;

  return (
    <div role="treeitem" aria-expanded={entry.is_dir ? isExpanded : undefined}>
      <button
        type="button"
        className={`tree-row ${isActive ? "active" : ""}`}
        style={{ paddingLeft: TREE_BASE_INDENT + depth * TREE_DEPTH_INDENT }}
        onClick={() =>
          entry.is_dir ? void onToggleFolder(entry) : void onSelectFile(entry)
        }
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
          <FileText size={15} />
        )}
        <span className="tree-name">{entry.name}</span>
      </button>

      {entry.is_dir && isExpanded ? (
        <div role="group">
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
                onToggleFolder={onToggleFolder}
                onSelectFile={onSelectFile}
              />
            ))
          ) : children ? (
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
