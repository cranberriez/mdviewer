import type { MouseEvent as ReactMouseEvent } from "react";
import { Home } from "lucide-react";
import type { Entry } from "../../../shared/types/files";
import { EmptySidebar } from "./EmptySidebar";
import { TreeNode } from "./TreeNode";
import { TreeInlineInput, type InlineDraft } from "./TreeInlineInput";

interface SidebarProps {
  width: number;
  locations: Entry[];
  activeRoot: Entry | null;
  rootChildren?: Entry[];
  expanded: Set<string>;
  childrenCache: Record<string, Entry[]>;
  loadingPaths: Set<string>;
  selectedFolderPath?: string;
  activeFilePath?: string;
  contextPath?: string;
  focusedPath?: string;
  draft: InlineDraft | null;
  onSelectLocation: (location: Entry) => Promise<void>;
  onToggleFolder: (entry: Entry) => Promise<void>;
  onSelectFile: (entry: Entry) => Promise<void>;
  onEntryContextMenu: (entry: Entry, event: ReactMouseEvent) => void;
  onRootContextMenu: (event: ReactMouseEvent) => void;
  onDraftSubmit: (value: string) => void;
  onDraftCancel: () => void;
}

export function Sidebar({
  width,
  locations,
  activeRoot,
  rootChildren,
  expanded,
  childrenCache,
  loadingPaths,
  selectedFolderPath,
  activeFilePath,
  contextPath,
  focusedPath,
  draft,
  onSelectLocation,
  onToggleFolder,
  onSelectFile,
  onEntryContextMenu,
  onRootContextMenu,
  onDraftSubmit,
  onDraftCancel,
}: SidebarProps) {
  const rootDraft =
    draft?.mode === "create" && activeRoot && draft.parentPath === activeRoot.path
      ? draft
      : null;

  return (
    <aside className="sidebar" style={{ width, flexBasis: width }} aria-label="File explorer">
      <section className="sidebar-section">
        <div className="section-label">Saved</div>
        <div className="saved-list">
          {locations.map((location) => (
            <button type="button" className={`saved-row ${selectedFolderPath === location.path ? "active" : ""}`} key={location.path} onClick={() => void onSelectLocation(location)}>
              <Home size={15} />
              <span>{location.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="sidebar-section explorer-section">
        <div className="explorer-heading">
          <div>
            <div className="section-label">Explorer</div>
          </div>
          {activeRoot ? <span className="entry-count">{rootChildren ? rootChildren.length : "..."}</span> : null}
        </div>

        <div
          className="tree"
          role="tree"
          onContextMenu={(event) => {
            // Only handle right-clicks on empty tree space; rows stop propagation
            // by handling their own contextmenu.
            if (event.target === event.currentTarget) {
              onRootContextMenu(event);
            }
          }}
        >
          {rootDraft ? (
            <TreeInlineInput
              draft={rootDraft}
              depth={0}
              onSubmit={onDraftSubmit}
              onCancel={onDraftCancel}
            />
          ) : null}
          {!activeRoot ? (
            <EmptySidebar message="No saved locations found." />
          ) : rootChildren ? (
            rootChildren.length > 0 ? (
              rootChildren.map((entry) => (
                <TreeNode
                  key={entry.path}
                  entry={entry}
                  depth={0}
                  expanded={expanded}
                  childrenCache={childrenCache}
                  loadingPaths={loadingPaths}
                  selectedFolderPath={selectedFolderPath}
                  activeFilePath={activeFilePath}
                  contextPath={contextPath}
                  focusedPath={focusedPath}
                  draft={draft}
                  onToggleFolder={onToggleFolder}
                  onSelectFile={onSelectFile}
                  onContextMenu={onEntryContextMenu}
                  onDraftSubmit={onDraftSubmit}
                  onDraftCancel={onDraftCancel}
                />
              ))
            ) : rootDraft ? null : (
              <EmptySidebar message="No markdown or text files here." />
            )
          ) : (
            <EmptySidebar message="Loading folder..." />
          )}
        </div>
      </section>
    </aside>
  );
}
