import type { MouseEvent as ReactMouseEvent } from "react";
import { FolderOpen, Moon, Pin, PinOff, Sun } from "lucide-react";
import type { Entry } from "../../../shared/types/files";
import type { AppTheme } from "../../../shared/state/persistence";
import { EmptySidebar } from "./EmptySidebar";
import { TreeNode } from "./TreeNode";
import { TreeInlineInput, type InlineDraft } from "./TreeInlineInput";
import { getIconComponent } from "./IconPickerMenu";

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
  onSavedContextMenu: (location: Entry, event: ReactMouseEvent) => void;
  onOpenFolder: () => void;
  /** Whether the current explorer root is already pinned. */
  rootPinned: boolean;
  /** Whether the pin toggle is disabled (Home, or no root). */
  rootPinDisabled: boolean;
  onToggleRootPin: () => void;
  onDraftSubmit: (value: string) => void;
  onDraftCancel: () => void;
  /** Custom icon name per saved-location path. */
  locationIcons?: Record<string, string>;
  /** Path of Home (first default location) — its icon is always Home and can't be changed. */
  homePath?: string;
  theme: AppTheme;
  onToggleTheme: () => void;
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
  onSavedContextMenu,
  onOpenFolder,
  rootPinned,
  rootPinDisabled,
  onToggleRootPin,
  onDraftSubmit,
  onDraftCancel,
  locationIcons,
  homePath,
  theme,
  onToggleTheme,
}: SidebarProps) {
  const rootDraft =
    draft?.mode === "create" && activeRoot && draft.parentPath === activeRoot.path
      ? draft
      : null;

  return (
    <aside className="sidebar" style={{ width, flexBasis: width }} aria-label="File explorer">
      <section className="sidebar-section">
        <div className="saved-heading">
          <div className="section-label">Saved</div>
          <div className="saved-actions">
            <button
              type="button"
              className={`saved-add ${rootPinned ? "is-pinned" : ""}`}
              disabled={rootPinDisabled}
              title={
                rootPinDisabled
                  ? "Home is always pinned"
                  : rootPinned
                    ? "Unpin the current root folder"
                    : "Pin the current root folder"
              }
              aria-label={
                rootPinned ? "Unpin current root folder" : "Pin current root folder"
              }
              aria-pressed={rootPinned}
              onClick={onToggleRootPin}
            >
              {rootPinned ? <PinOff size={15} /> : <Pin size={15} />}
            </button>
            <button
              type="button"
              className="saved-add"
              title="Open a folder as the explorer root…"
              aria-label="Open folder"
              onClick={onOpenFolder}
            >
              <FolderOpen size={15} />
            </button>
          </div>
        </div>
        <div className="saved-list">
          {locations.map((location) => {
            const isHome = homePath ? location.path === homePath : false;
            const iconName = isHome ? "Home" : (locationIcons?.[location.path] ?? "Folder");
            const LocationIcon = getIconComponent(iconName);
            return (
              <button
                type="button"
                className={`saved-row ${selectedFolderPath === location.path ? "active" : ""}`}
                key={location.path}
                onClick={() => void onSelectLocation(location)}
                onContextMenu={(event) => onSavedContextMenu(location, event)}
              >
                <LocationIcon size={15} />
                <span>{location.name}</span>
              </button>
            );
          })}
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

      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-footer-button"
          title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          onClick={onToggleTheme}
        >
          {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
        </button>
      </div>
    </aside>
  );
}
