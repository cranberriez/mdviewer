import type { MouseEvent as ReactMouseEvent } from 'react';
import { useUiStore } from '../../app-shell/state/useUiStore';
import type { InternalDragStart } from '../../dnd/dropTypes';
import { OutlineView } from '../../outline/components/OutlineView';
import type { Entry, FileSearchMatch } from '../../../shared/types/files';
import type { RecentFile, RecentItem } from '../../../shared/state/persistence';
import { CrossFileSearchPanel } from './CrossFileSearchPanel';
import { EmptySidebar } from './EmptySidebar';
import { SidebarExplorerHeader } from './SidebarExplorerHeader';
import { SidebarFooter } from './SidebarFooter';
import { SidebarSourceList } from './SidebarSourceList';
import { TreeInlineInput, type InlineDraft } from './TreeInlineInput';
import { TreeNode } from './TreeNode';

export type SidebarMode = 'explorer' | 'recent' | 'search' | 'outline';

interface SidebarSearchProps {
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
	search: SidebarSearchProps;
	outlineHtml: string | null;
	hasOpenFile: boolean;
	showOutlineTab: boolean;
	onSelectHeading: (id: string) => void;
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
	onOpenRecent: (item: RecentItem) => void;
	onOpenRecentFile: (file: RecentFile) => void;
	onRecentContextMenu: (item: RecentItem, event: ReactMouseEvent) => void;
	onOpenFolder: () => void;
	rootPinned: boolean;
	rootPinDisabled: boolean;
	onToggleRootPin: () => void;
	onDraftSubmit: (value: string) => void;
	onDraftCancel: () => void;
	dropTargetPath?: string | null;
	rootDropActive?: boolean;
	onEntryPointerDown: InternalDragStart;
	homePath?: string;
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
	search,
	outlineHtml,
	hasOpenFile,
	showOutlineTab,
	onSelectHeading,
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
	onOpenRecent,
	onOpenRecentFile,
	onRecentContextMenu,
	onOpenFolder,
	rootPinned,
	rootPinDisabled,
	onToggleRootPin,
	onDraftSubmit,
	onDraftCancel,
	dropTargetPath,
	rootDropActive,
	onEntryPointerDown,
	homePath,
}: SidebarProps) {
	const sidebarMode = useUiStore((state) => state.sidebarMode);
	const rootDraft =
		draft?.mode === 'create' && activeRoot && draft.parentPath === activeRoot.path ? draft : null;
	const effectiveMode: SidebarMode =
		sidebarMode === 'outline' && !showOutlineTab ? 'explorer' : sidebarMode;
	const showingSearchResults = effectiveMode === 'search' && Boolean(search.searchedQuery.trim());
	const showingOutline = effectiveMode === 'outline';

	return (
		<aside className="sidebar" style={{ width, flexBasis: width }} aria-label="File explorer">
			<SidebarSourceList
				locations={locations}
				search={search}
				homePath={homePath}
				rootPinned={rootPinned}
				rootPinDisabled={rootPinDisabled}
				showOutlineTab={showOutlineTab}
				onOpenFolder={onOpenFolder}
				onSavedContextMenu={onSavedContextMenu}
				onOpenRecent={onOpenRecent}
				onOpenRecentFile={onOpenRecentFile}
				onRecentContextMenu={onRecentContextMenu}
				onSelectLocation={onSelectLocation}
				onSourcesHeaderContextMenu={onSourcesHeaderContextMenu}
				onToggleRootPin={onToggleRootPin}
			/>

			<section className="sidebar-section explorer-section">
				<SidebarExplorerHeader
					showingOutline={showingOutline}
					showingSearchResults={showingSearchResults}
					onCreateRootFile={onCreateRootFile}
					onCreateRootFolder={onCreateRootFolder}
					onExplorerHeaderContextMenu={onExplorerHeaderContextMenu}
					onRefreshRoot={onRefreshRoot}
				/>

				{showingOutline ? (
					<OutlineView
						renderedHtml={outlineHtml}
						hasOpenFile={hasOpenFile}
						onSelect={onSelectHeading}
					/>
				) : showingSearchResults ? (
					<CrossFileSearchPanel
						root={activeRoot?.path ?? null}
						query={search.query}
						searchedQuery={search.searchedQuery}
						results={search.results}
						loading={search.loading}
						error={search.error}
						truncated={search.truncated}
						showForm={false}
						showResults
						onQueryChange={search.onQueryChange}
						onClear={search.onClear}
						onSubmit={search.onSubmit}
						onOpenResult={search.onOpenResult}
					/>
				) : (
					<div
						className={`tree ${rootDropActive ? 'drop-target-root' : ''}`}
						role="tree"
						data-drop-zone="tree-blank"
						data-drop-path={activeRoot?.path ?? ''}
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

			<SidebarFooter />
		</aside>
	);
}
