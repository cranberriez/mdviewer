import type { MouseEvent as ReactMouseEvent } from 'react';
import { Clock3, FileText, Folder, FolderOpen, List, Pin, PinOff, Search } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import type { Entry, FileSearchMatch } from '../../../shared/types/files';
import {
	recentItemKind,
	type RecentFile,
	type RecentItem,
} from '../../../shared/state/persistence';
import { comparablePath } from '../../../shared/utils/path';
import { useUiStore } from '../../app-shell/state/useUiStore';
import { useSavedLocationsStore } from '../../saved-locations/state/useSavedLocationsStore';
import { CrossFileSearchPanel } from './CrossFileSearchPanel';
import { getIconComponent } from './IconPickerMenu';
import { SidebarHeaderActions, type SidebarHeaderActionConfig } from './SidebarHeaderActions';
import { useExplorerStore } from '../state/useExplorerStore';
import type { SidebarMode } from './Sidebar';

interface SidebarSourceListProps {
	locations: Entry[];
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
	homePath?: string;
	rootPinned: boolean;
	rootPinDisabled: boolean;
	showOutlineTab: boolean;
	onOpenFolder: () => void;
	onSavedContextMenu: (location: Entry, event: ReactMouseEvent) => void;
	onOpenRecent: (item: RecentItem) => void;
	onOpenRecentFile: (file: RecentFile) => void;
	onRecentContextMenu: (item: RecentItem, event: ReactMouseEvent) => void;
	onSelectLocation: (location: Entry) => Promise<void>;
	onSourcesHeaderContextMenu: (event: ReactMouseEvent) => void;
	onToggleRootPin: () => void;
}

export function SidebarSourceList({
	locations,
	search,
	homePath,
	rootPinned,
	rootPinDisabled,
	showOutlineTab,
	onOpenFolder,
	onSavedContextMenu,
	onOpenRecent,
	onOpenRecentFile,
	onRecentContextMenu,
	onSelectLocation,
	onSourcesHeaderContextMenu,
	onToggleRootPin,
}: SidebarSourceListProps) {
	const activeRootPath = useExplorerStore((state) => state.activeRoot?.path ?? null);
	const selectedFolderPath = useExplorerStore((state) => state.selectedFolderPath);
	const locationIcons = useSavedLocationsStore((state) => state.locationIcons);
	const recents = useSavedLocationsStore((state) => state.recents);
	const activeRecent = recents.find(
		(item) =>
			recentItemKind(item) === 'root' &&
			activeRootPath !== null &&
			comparablePath(item.path) === comparablePath(activeRootPath)
	);
	const activeRecentFiles =
		activeRecent?.recentFiles?.length || !activeRecent?.lastFile
			? (activeRecent?.recentFiles ?? [])
			: [activeRecent.lastFile];
	const { sidebarMode, sourcesHeaderActionsVisible, setSidebarMode } = useUiStore(
		useShallow((state) => ({
			sidebarMode: state.sidebarMode,
			sourcesHeaderActionsVisible: state.sourcesHeaderActionsVisible,
			setSidebarMode: state.setSidebarMode,
		}))
	);
	const effectiveMode: SidebarMode =
		sidebarMode === 'outline' && !showOutlineTab ? 'explorer' : sidebarMode;
	const sourceViewActions: SidebarHeaderActionConfig[] = [
		{
			id: 'explorer',
			icon: Folder,
			tooltip: 'Explorer',
			active: effectiveMode === 'explorer',
			role: 'tab',
			ariaSelected: effectiveMode === 'explorer',
			onClick: () => setSidebarMode('explorer'),
		},
		{
			id: 'recent',
			icon: Clock3,
			tooltip: 'Recent',
			active: effectiveMode === 'recent',
			role: 'tab',
			ariaSelected: effectiveMode === 'recent',
			onClick: () => setSidebarMode('recent'),
		},
		{
			id: 'search',
			icon: Search,
			tooltip: 'Search files',
			visible: sourcesHeaderActionsVisible.search,
			active: effectiveMode === 'search',
			role: 'tab',
			ariaSelected: effectiveMode === 'search',
			onClick: () => setSidebarMode('search'),
		},
		{
			id: 'outline',
			icon: List,
			tooltip: 'Outline',
			visible: showOutlineTab && sourcesHeaderActionsVisible.outline,
			active: effectiveMode === 'outline',
			role: 'tab',
			ariaSelected: effectiveMode === 'outline',
			onClick: () => setSidebarMode('outline'),
		},
	];
	const sourceHeaderActions: SidebarHeaderActionConfig[] = [
		{
			id: 'toggle-root-pin',
			icon: rootPinned ? PinOff : Pin,
			tooltip: rootPinDisabled
				? 'Home is always pinned'
				: rootPinned
					? 'Unpin the current root folder'
					: 'Pin the current root folder',
			className: rootPinned ? 'is-pinned' : undefined,
			visible: sourcesHeaderActionsVisible.pin,
			active: rootPinned,
			disabled: rootPinDisabled,
			ariaPressed: rootPinned,
			onClick: onToggleRootPin,
		},
		{
			id: 'open-folder',
			icon: FolderOpen,
			tooltip: 'Open a folder as the explorer root...',
			onClick: onOpenFolder,
		},
	];

	return (
		<section className="sidebar-section">
			<div className="saved-heading" onContextMenu={onSourcesHeaderContextMenu}>
				<div className="sidebar-view-switch" role="tablist" aria-label="Sidebar view">
					<SidebarHeaderActions
						actions={sourceViewActions}
						baseClassName="sidebar-view-button"
						iconSize={14}
					/>
				</div>
				<div className="saved-actions">
					<SidebarHeaderActions
						actions={sourceHeaderActions}
						baseClassName="saved-add"
						iconSize={15}
					/>
				</div>
			</div>
			{effectiveMode === 'outline' ? null : effectiveMode === 'search' ? (
				<CrossFileSearchPanel
					root={activeRootPath}
					query={search.query}
					searchedQuery={search.searchedQuery}
					results={search.results}
					loading={search.loading}
					error={search.error}
					truncated={search.truncated}
					showForm
					showResults={false}
					onQueryChange={search.onQueryChange}
					onClear={search.onClear}
					onSubmit={search.onSubmit}
					onOpenResult={search.onOpenResult}
				/>
			) : effectiveMode === 'recent' ? (
				<div className="saved-list recent-source-list">
					{activeRecentFiles.length > 0 ? (
						activeRecentFiles.map((file) => (
							<button
								type="button"
								className="saved-row recent-source-row"
								key={file.path}
								title={file.path}
								onClick={() => onOpenRecentFile(file)}
							>
								<FileText size={15} />
								<span>{file.name}</span>
							</button>
						))
					) : recents.length === 0 ? (
						<span className="sidebar-source-empty">No recent files or folders.</span>
					) : (
						recents.map((item) => {
							const isFile = recentItemKind(item) === 'file';
							const Icon = isFile ? FileText : FolderOpen;
							return (
								<button
									type="button"
									className="saved-row recent-source-row"
									key={`${isFile ? 'file' : 'root'}:${item.path}`}
									title={item.path}
									onClick={() => onOpenRecent(item)}
									onContextMenu={(event) => onRecentContextMenu(item, event)}
								>
									<Icon size={15} />
									<span>{item.lastFile?.name ?? item.name}</span>
								</button>
							);
						})
					)}
				</div>
			) : (
				<div className="saved-list">
					{locations.map((location) => {
						const isHome = homePath ? location.path === homePath : false;
						const iconName = isHome ? 'Home' : (locationIcons[location.path] ?? 'Folder');
						const LocationIcon = getIconComponent(iconName);
						return (
							<button
								type="button"
								className={`saved-row ${selectedFolderPath === location.path ? 'active' : ''}`}
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
	);
}
