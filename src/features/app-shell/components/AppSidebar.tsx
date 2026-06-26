import type { MouseEvent as ReactMouseEvent } from 'react';
import type { Entry, FileSearchMatch } from '../../../shared/types/files';
import type {
	AppTheme,
	ExplorerHeaderActionsVisibility,
	SourcesHeaderActionsVisibility,
} from '../../../shared/state/persistence';
import type { InternalDragStart } from '../../dnd/dropTypes';
import { Sidebar, type SidebarMode } from '../../explorer/components/Sidebar';
import type { InlineDraft } from '../../explorer/components/TreeInlineInput';

interface AppSidebarProps {
	layout: {
		explorerHidden: boolean;
		sidebarWidth: number;
		mode: SidebarMode;
		onModeChange: (mode: SidebarMode) => void;
	};
	locations: {
		items: Entry[];
		activeRoot: Entry | null;
		selectedFolderPath?: string;
		icons: Record<string, string>;
		homePath?: string;
		rootPinned: boolean;
		rootPinDisabled: boolean;
		onSelect: (location: Entry) => Promise<void>;
		onContextMenu: (location: Entry, event: ReactMouseEvent) => void;
		onOpenFolder: () => void;
		onToggleRootPin: () => void;
	};
	tree: {
		rootChildren?: Entry[];
		expanded: Set<string>;
		childrenCache: Record<string, Entry[]>;
		loadingPaths: Set<string>;
		activeFilePath?: string;
		unsavedFilePathKeys: Set<string>;
		contextPath?: string;
		focusedPath?: string;
		draft: InlineDraft | null;
		rootRefreshing: boolean;
		dropTargetPath?: string | null;
		rootDropActive: boolean;
		onToggleFolder: (entry: Entry) => Promise<void>;
		onSelectFile: (entry: Entry) => Promise<void>;
		onEntryContextMenu: (entry: Entry, event: ReactMouseEvent) => void;
		onRootContextMenu: (event: ReactMouseEvent) => void;
		onDraftSubmit: (value: string) => void;
		onDraftCancel: () => void;
		onEntryPointerDown: InternalDragStart;
	};
	headers: {
		explorerActionsVisible: ExplorerHeaderActionsVisibility;
		sourcesActionsVisible: SourcesHeaderActionsVisibility;
		onRefreshRoot: () => void;
		onCreateRootFile: () => void;
		onCreateRootFolder: () => void;
		onExplorerContextMenu: (event: ReactMouseEvent) => void;
		onSourcesContextMenu: (event: ReactMouseEvent) => void;
	};
	search: {
		query: string;
		searchedQuery: string;
		results: FileSearchMatch[];
		loading: boolean;
		error: string | null;
		truncated: boolean;
		onQueryChange: (query: string) => void;
		onClear: () => void;
		onSubmit: () => void;
		onOpenResult: (result: FileSearchMatch) => void;
	};
	outline: {
		html: string | null;
		hasOpenFile: boolean;
		showTab: boolean;
		onSelectHeading: (id: string) => void;
	};
	appearance: {
		theme: AppTheme;
		onToggleTheme: () => void;
	};
}

export function AppSidebar({
	layout,
	locations,
	tree,
	headers,
	search,
	outline,
	appearance,
}: AppSidebarProps) {
	return (
		<Sidebar
			width={layout.explorerHidden ? 0 : layout.sidebarWidth}
			locations={locations.items}
			activeRoot={locations.activeRoot}
			rootChildren={tree.rootChildren}
			expanded={tree.expanded}
			childrenCache={tree.childrenCache}
			loadingPaths={tree.loadingPaths}
			selectedFolderPath={locations.selectedFolderPath}
			activeFilePath={tree.activeFilePath}
			unsavedFilePathKeys={tree.unsavedFilePathKeys}
			contextPath={tree.contextPath}
			focusedPath={tree.focusedPath}
			draft={tree.draft}
			sidebarMode={layout.mode}
			searchQuery={search.query}
			searchedQuery={search.searchedQuery}
			searchResults={search.results}
			searchLoading={search.loading}
			searchError={search.error}
			searchTruncated={search.truncated}
			rootRefreshing={tree.rootRefreshing}
			explorerHeaderActionsVisible={headers.explorerActionsVisible}
			sourcesHeaderActionsVisible={headers.sourcesActionsVisible}
			outlineHtml={outline.html}
			hasOpenFile={outline.hasOpenFile}
			showOutlineTab={outline.showTab}
			onSelectHeading={outline.onSelectHeading}
			onSidebarModeChange={layout.onModeChange}
			onSearchQueryChange={search.onQueryChange}
			onSearchClear={search.onClear}
			onSearchSubmit={search.onSubmit}
			onOpenSearchResult={search.onOpenResult}
			onRefreshRoot={headers.onRefreshRoot}
			onCreateRootFile={headers.onCreateRootFile}
			onCreateRootFolder={headers.onCreateRootFolder}
			onExplorerHeaderContextMenu={headers.onExplorerContextMenu}
			onSourcesHeaderContextMenu={headers.onSourcesContextMenu}
			onSelectLocation={locations.onSelect}
			onToggleFolder={tree.onToggleFolder}
			onSelectFile={tree.onSelectFile}
			onEntryContextMenu={tree.onEntryContextMenu}
			onRootContextMenu={tree.onRootContextMenu}
			onSavedContextMenu={locations.onContextMenu}
			onOpenFolder={locations.onOpenFolder}
			rootPinned={locations.rootPinned}
			rootPinDisabled={locations.rootPinDisabled}
			onToggleRootPin={locations.onToggleRootPin}
			onDraftSubmit={tree.onDraftSubmit}
			onDraftCancel={tree.onDraftCancel}
			dropTargetPath={tree.dropTargetPath}
			rootDropActive={tree.rootDropActive}
			onEntryPointerDown={tree.onEntryPointerDown}
			locationIcons={locations.icons}
			homePath={locations.homePath}
			theme={appearance.theme}
			onToggleTheme={appearance.onToggleTheme}
		/>
	);
}
