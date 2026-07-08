import type { MouseEvent as ReactMouseEvent } from "react";
import {
  FilePlus,
  Folder,
  FolderOpen,
  FolderPlus,
  List,
  Moon,
  Pin,
  PinOff,
  RefreshCw,
  Search,
  Sun,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Entry, FileSearchMatch } from "../../../shared/types/files";
import type {
  AppTheme,
  ExplorerHeaderActionsVisibility,
  SourcesHeaderActionsVisibility,
} from "../../../shared/state/persistence";
import type { InternalDragStart } from "../../dnd/dropTypes";
import { EmptySidebar } from "./EmptySidebar";
import { TreeNode } from "./TreeNode";
import { TreeInlineInput, type InlineDraft } from "./TreeInlineInput";
import { getIconComponent } from "./IconPickerMenu";
import { CrossFileSearchPanel } from "./CrossFileSearchPanel";
import { OutlineView } from "../../outline/components/OutlineView";
import { IconActionButton } from "../../file-actions/components/IconActionButton";

export type SidebarMode = "explorer" | "search" | "outline";

interface HeaderActionConfig {
  id: string;
  icon: LucideIcon;
  tooltip: string;
  visible?: boolean;
  active?: boolean;
  disabled?: boolean;
  role?: "tab";
  ariaSelected?: boolean;
  ariaPressed?: boolean;
  ariaHasPopup?: "menu";
  className?: string;
  iconClassName?: string;
  onClick: (event: ReactMouseEvent) => void;
}

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
  explorerHeaderActionsVisible: ExplorerHeaderActionsVisibility;
  sourcesHeaderActionsVisible: SourcesHeaderActionsVisibility;
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
  onCreateRootFile: () => void;
  onCreateRootFolder: () => void;
  onExplorerHeaderContextMenu: (event: ReactMouseEvent) => void;
  onSourcesHeaderContextMenu: (event: ReactMouseEvent) => void;
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
  /** Start an in-app pointer drag of a tree entry. */
  onEntryPointerDown: InternalDragStart;
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
  explorerHeaderActionsVisible,
  sourcesHeaderActionsVisible,
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
  onCreateRootFile,
  onCreateRootFolder,
  onExplorerHeaderContextMenu,
  onSourcesHeaderContextMenu,
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
  onEntryPointerDown,
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
  const sourceViewActions: HeaderActionConfig[] = [
    {
      id: "explorer",
      icon: Folder,
      tooltip: "Explorer",
      active: effectiveMode === "explorer",
      role: "tab",
      ariaSelected: effectiveMode === "explorer",
      onClick: () => onSidebarModeChange("explorer"),
    },
    {
      id: "search",
      icon: Search,
      tooltip: "Search files",
      visible: sourcesHeaderActionsVisible.search,
      active: effectiveMode === "search",
      role: "tab",
      ariaSelected: effectiveMode === "search",
      onClick: () => onSidebarModeChange("search"),
    },
    {
      id: "outline",
      icon: List,
      tooltip: "Outline",
      visible: showOutlineTab && sourcesHeaderActionsVisible.outline,
      active: effectiveMode === "outline",
      role: "tab",
      ariaSelected: effectiveMode === "outline",
      onClick: () => onSidebarModeChange("outline"),
    },
  ];
  const sourceHeaderActions: HeaderActionConfig[] = [
    {
      id: "toggle-root-pin",
      icon: rootPinned ? PinOff : Pin,
      tooltip: rootPinDisabled
        ? "Home is always pinned"
        : rootPinned
          ? "Unpin the current root folder"
          : "Pin the current root folder",
      className: rootPinned ? "is-pinned" : undefined,
      visible: sourcesHeaderActionsVisible.pin,
      active: rootPinned,
      disabled: rootPinDisabled,
      ariaPressed: rootPinned,
      onClick: onToggleRootPin,
    },
    {
      id: "open-folder",
      icon: FolderOpen,
      tooltip: "Open a folder as the explorer root…",
      onClick: onOpenFolder,
    },
  ];
  const explorerHeaderActions: HeaderActionConfig[] = [
    {
      id: "new-file",
      icon: FilePlus,
      tooltip: "Add file",
      visible: explorerHeaderActionsVisible.newFile,
      onClick: onCreateRootFile,
    },
    {
      id: "new-folder",
      icon: FolderPlus,
      tooltip: "Add folder",
      visible: explorerHeaderActionsVisible.newFolder,
      onClick: onCreateRootFolder,
    },
    {
      id: "refresh",
      icon: RefreshCw,
      tooltip: "Refresh explorer",
      visible: explorerHeaderActionsVisible.refresh,
      disabled: rootRefreshing,
      iconClassName: rootRefreshing ? "search-spinner" : undefined,
      onClick: onRefreshRoot,
    },
  ];

  const renderHeaderActions = (
    actions: HeaderActionConfig[],
    baseClassName: string,
    iconSize: number,
  ) =>
    actions
      .filter((action) => action.visible ?? true)
      .map((action) => {
        const Icon = action.icon;
        return (
          <IconActionButton
            key={action.id}
            className={`${baseClassName} ${action.className ?? ""} ${
              action.active ? "active" : ""
            }`}
            tooltip={action.tooltip}
            title={action.tooltip}
            active={action.active}
            disabled={action.disabled}
            role={action.role}
            aria-selected={action.ariaSelected}
            aria-pressed={action.ariaPressed}
            aria-haspopup={action.ariaHasPopup}
            onClick={(event) => action.onClick(event)}
          >
            <Icon className={action.iconClassName} size={iconSize} />
          </IconActionButton>
        );
      });

  return (
    <aside className="sidebar" style={{ width, flexBasis: width }} aria-label="File explorer">
      <section className="sidebar-section">
        <div className="saved-heading" onContextMenu={onSourcesHeaderContextMenu}>
          <div className="sidebar-view-switch" role="tablist" aria-label="Sidebar view">
            {renderHeaderActions(sourceViewActions, "sidebar-view-button", 14)}
          </div>
          <div className="saved-actions">
            {renderHeaderActions(sourceHeaderActions, "saved-add", 15)}
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
        <div
          className="explorer-heading"
          onContextMenu={
            !showingSearchResults && !showingOutline && activeRoot
              ? onExplorerHeaderContextMenu
              : undefined
          }
        >
          <div>
            <div className="section-label">
              {showingOutline ? "Outline" : showingSearchResults ? "Search" : "Explorer"}
            </div>
          </div>
          {!showingSearchResults && !showingOutline && activeRoot ? (
            <div className="explorer-actions">
              {renderHeaderActions(explorerHeaderActions, "explorer-header-action", 14)}
            </div>
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
            onContextMenu={onRootContextMenu}
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
                    onEntryPointerDown={onEntryPointerDown}
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
