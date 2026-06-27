import type { ComponentProps, MouseEvent as ReactMouseEvent, ReactNode, RefObject } from 'react';
import type { Entry, FileSearchMatch, OpenFile } from '../../../shared/types/files';
import type {
	AppTheme,
	ExplorerHeaderActionsVisibility,
	RecentItem,
	SourcesHeaderActionsVisibility,
} from '../../../shared/state/persistence';
import type { DragSessionState, InternalDragStart } from '../../dnd/dropTypes';
import { SidebarResizeHandle } from '../../explorer/components/SidebarResizeHandle';
import { Sidebar, type SidebarMode } from '../../explorer/components/Sidebar';
import type { InlineDraft } from '../../explorer/components/TreeInlineInput';
import type { FileViewMode } from '../../file-actions/components/FileActionControls';
import { HomeView } from '../../home/components/HomeView';
import type { MarkdownAction } from '../../preview/markdownActions';
import type { MenuBarState } from '../../window-chrome/components/MenuBar';
import { TitleBar } from '../../window-chrome/components/TitleBar';
import { AppPreviewArea } from './AppPreviewArea';

interface WorkspaceFindState {
	current: number;
	open: boolean;
	query: string;
	total: number;
	close: () => void;
	goToNext: () => void;
	goToPrevious: () => void;
	setQuery: (query: string) => void;
}

interface AppWorkspaceProps {
	shell: {
		activeRoot: Entry | null;
		barMerged: boolean;
		breadcrumbScope: string | null;
		explorerHidden: boolean;
		fileActionsSlot: ReactNode;
		menuState: MenuBarState;
		overlay: 'onboarding' | 'home' | null;
		title: string;
		onMenuAction: (id: string) => void;
		onToggleExplorer: () => void;
	};
	sidebar: {
		activeFilePath?: string;
		activeRoot: Entry | null;
		beginInternalDrag: InternalDragStart;
		childrenCache: Record<string, Entry[]>;
		contextPath?: string;
		draft: InlineDraft | null;
		expanded: Set<string>;
		explorerHeaderActionsVisible: ExplorerHeaderActionsVisibility;
		focusedPath?: string;
		homePath?: string;
		loadingPaths: Set<string>;
		locations: Entry[];
		locationIcons: Record<string, string>;
		mode: SidebarMode;
		rootChildren?: Entry[];
		rootDropActive: boolean;
		rootPinned: boolean;
		rootPinDisabled: boolean;
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
		selectedFolderPath?: string;
		sidebarWidth: number;
		sourcesHeaderActionsVisible: SourcesHeaderActionsVisibility;
		theme: AppTheme;
		treeDropTargetPath?: string | null;
		unsavedFilePathKeys: Set<string>;
		onCreateRootFile: () => void;
		onCreateRootFolder: () => void;
		onDraftCancel: () => void;
		onDraftSubmit: (value: string) => void;
		onEntryContextMenu: (entry: Entry, event: ReactMouseEvent) => void;
		onExplorerHeaderContextMenu: (event: ReactMouseEvent) => void;
		onOpenFolder: () => void;
		onRefreshRoot: () => void;
		onRootContextMenu: (event: ReactMouseEvent) => void;
		onSavedContextMenu: (location: Entry, event: ReactMouseEvent) => void;
		onSelectFile: (entry: Entry) => Promise<void>;
		onSelectHeading: (id: string) => void;
		onSelectLocation: (location: Entry) => Promise<void>;
		onSidebarModeChange: (mode: SidebarMode) => void;
		onSourcesHeaderContextMenu: (event: ReactMouseEvent) => void;
		onToggleFolder: (entry: Entry) => Promise<void>;
		onToggleRootPin: () => void;
		onToggleTheme: () => void;
	};
	home: {
		dropActive: boolean;
		homePath?: string;
		locationIcons: Record<string, string>;
		locations: Entry[];
		recents: RecentItem[];
		userName: string;
		onEditSetup: () => void;
		onLocationContextMenu: (location: Entry, event: ReactMouseEvent) => void;
		onOpenFolder: () => void;
		onOpenRecent: (item: RecentItem) => void;
		onRecentContextMenu: (item: RecentItem, event: ReactMouseEvent) => void;
		onSelectLocation: (location: Entry) => void;
	};
	preview: {
		actionBar: ReactNode;
		dropCount: number;
		dropState: DragSessionState;
		error: string | null;
		find: WorkspaceFindState;
		findTargetRef: RefObject<HTMLElement | null>;
		mode: FileViewMode;
		openFile: OpenFile | null;
		outlinePanelVisible: boolean;
		pendingFormatAction: { action: MarkdownAction; id: number } | null;
		renderedMarkdown: string;
		onContentChange: (content: string) => void;
		onLinkClick: (href: string) => void;
		onSelectHeading: (id: string) => void;
	};
	resize: {
		onPointerDown: ComponentProps<typeof SidebarResizeHandle>['onPointerDown'];
	};
}

export function AppWorkspace({ shell, sidebar, home, preview, resize }: AppWorkspaceProps) {
	const overlay = shell.overlay;

	return (
		<>
			<TitleBar
				fileActionsSlot={shell.barMerged ? shell.fileActionsSlot : null}
				explorerHidden={shell.explorerHidden || overlay !== null}
				menuState={shell.menuState}
				rootName={overlay ? undefined : shell.activeRoot?.name}
				scopeName={overlay ? null : shell.breadcrumbScope}
				title={overlay ? 'Markdown Viewer' : shell.title}
				onMenuAction={shell.onMenuAction}
				onToggleExplorer={shell.onToggleExplorer}
				hideExplorerToggle={overlay !== null}
			/>

			<div className="workspace">
				{overlay === null ? (
					<Sidebar
						width={shell.explorerHidden ? 0 : sidebar.sidebarWidth}
						locations={sidebar.locations}
						activeRoot={sidebar.activeRoot}
						rootChildren={sidebar.rootChildren}
						expanded={sidebar.expanded}
						childrenCache={sidebar.childrenCache}
						loadingPaths={sidebar.loadingPaths}
						selectedFolderPath={sidebar.selectedFolderPath}
						activeFilePath={sidebar.activeFilePath}
						unsavedFilePathKeys={sidebar.unsavedFilePathKeys}
						contextPath={sidebar.contextPath}
						focusedPath={sidebar.focusedPath}
						draft={sidebar.draft}
						sidebarMode={sidebar.mode}
						searchQuery={sidebar.search.query}
						searchedQuery={sidebar.search.searchedQuery}
						searchResults={sidebar.search.results}
						searchLoading={sidebar.search.loading}
						searchError={sidebar.search.error}
						searchTruncated={sidebar.search.truncated}
						rootRefreshing={
							sidebar.activeRoot ? sidebar.loadingPaths.has(sidebar.activeRoot.path) : false
						}
						explorerHeaderActionsVisible={sidebar.explorerHeaderActionsVisible}
						sourcesHeaderActionsVisible={sidebar.sourcesHeaderActionsVisible}
						outlineHtml={preview.openFile?.kind === 'md' ? preview.renderedMarkdown : null}
						hasOpenFile={Boolean(preview.openFile)}
						showOutlineTab={!preview.outlinePanelVisible}
						onSelectHeading={sidebar.onSelectHeading}
						onSidebarModeChange={sidebar.onSidebarModeChange}
						onSearchQueryChange={sidebar.search.onQueryChange}
						onSearchClear={sidebar.search.onClear}
						onSearchSubmit={sidebar.search.onSubmit}
						onOpenSearchResult={sidebar.search.onOpenResult}
						onRefreshRoot={sidebar.onRefreshRoot}
						onCreateRootFile={sidebar.onCreateRootFile}
						onCreateRootFolder={sidebar.onCreateRootFolder}
						onExplorerHeaderContextMenu={sidebar.onExplorerHeaderContextMenu}
						onSourcesHeaderContextMenu={sidebar.onSourcesHeaderContextMenu}
						onSelectLocation={sidebar.onSelectLocation}
						onToggleFolder={sidebar.onToggleFolder}
						onSelectFile={sidebar.onSelectFile}
						onEntryContextMenu={sidebar.onEntryContextMenu}
						onRootContextMenu={sidebar.onRootContextMenu}
						onSavedContextMenu={sidebar.onSavedContextMenu}
						onOpenFolder={sidebar.onOpenFolder}
						rootPinned={sidebar.rootPinned}
						rootPinDisabled={sidebar.rootPinDisabled}
						onToggleRootPin={sidebar.onToggleRootPin}
						onDraftSubmit={sidebar.onDraftSubmit}
						onDraftCancel={sidebar.onDraftCancel}
						dropTargetPath={sidebar.treeDropTargetPath}
						rootDropActive={sidebar.rootDropActive}
						onEntryPointerDown={sidebar.beginInternalDrag}
						locationIcons={sidebar.locationIcons}
						homePath={sidebar.homePath}
						theme={sidebar.theme}
						onToggleTheme={sidebar.onToggleTheme}
					/>
				) : null}

				{overlay === null ? <SidebarResizeHandle onPointerDown={resize.onPointerDown} /> : null}

				{overlay === 'home' ? (
					<HomeView
						userName={home.userName}
						locations={home.locations}
						recents={home.recents}
						homePath={home.homePath}
						locationIcons={home.locationIcons}
						onOpenFolder={home.onOpenFolder}
						onSelectLocation={home.onSelectLocation}
						onOpenRecent={home.onOpenRecent}
						onLocationContextMenu={home.onLocationContextMenu}
						onRecentContextMenu={home.onRecentContextMenu}
						onEditSetup={home.onEditSetup}
						dropActive={home.dropActive}
					/>
				) : (
					<AppPreviewArea {...preview} />
				)}
			</div>
		</>
	);
}
