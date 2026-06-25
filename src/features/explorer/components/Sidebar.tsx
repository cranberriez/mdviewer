import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { Folder, FolderOpen, List, Moon, Pin, PinOff, RefreshCw, Search, Sun } from "lucide-react";
import type { Entry, FileSearchMatch } from "../../../shared/types/files";
import type { AppTheme } from "../../../shared/state/persistence";
import { EmptySidebar } from "./EmptySidebar";
import { TreeNode } from "./TreeNode";
import { TreeInlineInput, type InlineDraft } from "./TreeInlineInput";
import { getIconComponent } from "./IconPickerMenu";
import { CrossFileSearchPanel } from "./CrossFileSearchPanel";
import { OutlineView } from "../../outline/components/OutlineView";

export type SidebarMode = "explorer" | "search" | "outline";

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
  unsavedFilePathKeys: Set<string>;
  contextPath?: string;
  focusedPath?: string;
  draft: InlineDraft | null;
  sidebarMode: SidebarMode;
  searchQuery: string;
  searchedQuery: string;
  searchResults: FileSearchMatch[];
  searchLoading: boolean;
  searchError: string | null;
  searchTruncated: boolean;
  rootRefreshing: boolean;
  /** Rendered markdown HTML for the open file, or null for non-markdown / none. */
  outlineHtml: string | null;
  /** Whether any file is open (drives the outline empty state). */
  hasOpenFile: boolean;
  /** Hide the outline tab (used when the floating outline panel is visible). */
  showOutlineTab: boolean;
  onSelectHeading: (id: string) => void;
  onSidebarModeChange: (mode: SidebarMode) => void;
  onSearchQueryChange: (query: string) => void;
  onSearchClear: () => void;
  onSearchSubmit: () => void;
  onOpenSearchResult: (result: FileSearchMatch) => void;
  onRefreshRoot: () => void;
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
  /** Folder path currently highlighted as the active drop target, if any. */
  dropTargetPath?: string | null;
  /** True while files are being dragged over blank tree space (root drop). */
  rootDropActive?: boolean;
  /** Start an in-app drag of a tree entry (drives overlays, escalates to OS). */
  onEntryDragStart: (items: { path: string; isDir: boolean }[], event: ReactPointerEvent) => void;
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
  unsavedFilePathKeys,
  contextPath,
  focusedPath,
  draft,
  sidebarMode,
  searchQuery,
  searchedQuery,
  searchResults,
  searchLoading,
  searchError,
  searchTruncated,
  rootRefreshing,
  outlineHtml,
  hasOpenFile,
  showOutlineTab,
  onSelectHeading,
  onSidebarModeChange,
  onSearchQueryChange,
  onSearchClear,
  onSearchSubmit,
  onOpenSearchResult,
  onRefreshRoot,
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
  dropTargetPath,
  rootDropActive,
  onEntryDragStart,
  locationIcons,
  homePath,
  theme,
  onToggleTheme,
}: SidebarProps) {
  const rootDraft =
    draft?.mode === "create" && activeRoot && draft.parentPath === activeRoot.path
      ? draft
      : null;
  // If the outline tab is hidden (floating panel is up) but the sidebar was left
  // on outline mode, fall back to the explorer view so the panel isn't empty.
  const effectiveMode: SidebarMode =
    sidebarMode === "outline" && !showOutlineTab ? "explorer" : sidebarMode;
  const showingSearchResults = effectiveMode === "search" && Boolean(searchedQuery.trim());
  const showingOutline = effectiveMode === "outline";

  return (
    <aside className="sidebar" style={{ width, flexBasis: width }} aria-label="File explorer">
      <section className="sidebar-section">
        <div className="saved-heading">
          <div className="sidebar-view-switch" role="tablist" aria-label="Sidebar view">
            <button
              type="button"
              className={`sidebar-view-button ${effectiveMode === "explorer" ? "active" : ""}`}
              role="tab"
              aria-selected={effectiveMode === "explorer"}
              title="Explorer"
              aria-label="Explorer"
              onClick={() => onSidebarModeChange("explorer")}
            >
              <Folder size={14} />
            </button>
            <button
              type="button"
              className={`sidebar-view-button ${effectiveMode === "search" ? "active" : ""}`}
              role="tab"
              aria-selected={effectiveMode === "search"}
              title="Search files"
              aria-label="Search files"
              onClick={() => onSidebarModeChange("search")}
            >
              <Search size={14} />
            </button>
            {showOutlineTab ? (
              <button
                type="button"
                className={`sidebar-view-button ${effectiveMode === "outline" ? "active" : ""}`}
                role="tab"
                aria-selected={effectiveMode === "outline"}
                title="Outline"
                aria-label="Outline"
                onClick={() => onSidebarModeChange("outline")}
              >
                <List size={14} />
              </button>
            ) : null}
          </div>
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
        {effectiveMode === "outline" ? null : effectiveMode === "search" ? (
          <CrossFileSearchPanel
            root={activeRoot?.path ?? null}
            query={searchQuery}
            searchedQuery={searchedQuery}
            results={searchResults}
            loading={searchLoading}
            error={searchError}
            truncated={searchTruncated}
            showForm
            showResults={false}
            onQueryChange={onSearchQueryChange}
            onClear={onSearchClear}
            onSubmit={onSearchSubmit}
            onOpenResult={onOpenSearchResult}
          />
        ) : (
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
        )}
      </section>

      <section className="sidebar-section explorer-section">
        <div className="explorer-heading">
          <div>
            <div className="section-label">
              {showingOutline ? "Outline" : showingSearchResults ? "Search" : "Explorer"}
            </div>
          </div>
          {!showingSearchResults && !showingOutline && activeRoot ? (
            <button
              type="button"
              className="explorer-refresh"
              title="Refresh explorer"
              aria-label="Refresh explorer"
              disabled={rootRefreshing}
              onClick={onRefreshRoot}
            >
              <RefreshCw className={rootRefreshing ? "search-spinner" : undefined} size={14} />
            </button>
          ) : null}
        </div>

        {showingOutline ? (
          <OutlineView
            renderedHtml={outlineHtml}
            hasOpenFile={hasOpenFile}
            onSelect={onSelectHeading}
          />
        ) : showingSearchResults ? (
          <CrossFileSearchPanel
            root={activeRoot?.path ?? null}
            query={searchQuery}
            searchedQuery={searchedQuery}
            results={searchResults}
            loading={searchLoading}
            error={searchError}
            truncated={searchTruncated}
            showForm={false}
            showResults
            onQueryChange={onSearchQueryChange}
            onClear={onSearchClear}
            onSubmit={onSearchSubmit}
            onOpenResult={onOpenSearchResult}
          />
        ) : (
          <div
            className={`tree ${rootDropActive ? "drop-target-root" : ""}`}
            role="tree"
            data-drop-zone="tree-blank"
            data-drop-path={activeRoot?.path ?? ""}
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
                    unsavedFilePathKeys={unsavedFilePathKeys}
                    contextPath={contextPath}
                    focusedPath={focusedPath}
                    dropTargetPath={dropTargetPath}
                    onEntryDragStart={onEntryDragStart}
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
        )}
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
