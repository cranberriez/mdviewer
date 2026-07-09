import type { MouseEvent as ReactMouseEvent } from 'react';
import { FileText, FolderOpen, Pin, PinOff } from 'lucide-react';
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
	showOutlineTab: boolean;
	onPinLocation: (location: Entry) => void;
	onSavedContextMenu: (location: Entry, event: ReactMouseEvent) => void;
	onOpenRecent: (item: RecentItem) => void;
	onOpenRecentFile: (file: RecentFile) => void;
	onRecentContextMenu: (item: RecentItem, event: ReactMouseEvent) => void;
	onSelectLocation: (location: Entry) => Promise<void>;
	onUnpinLocation: (location: Entry) => void;
}

export function SidebarSourceList({
	locations,
	search,
	homePath,
	showOutlineTab,
	onPinLocation,
	onSavedContextMenu,
	onOpenRecent,
	onOpenRecentFile,
	onRecentContextMenu,
	onSelectLocation,
	onUnpinLocation,
}: SidebarSourceListProps) {
	const activeRoot = useExplorerStore((state) => state.activeRoot);
	const activeRootPath = activeRoot?.path ?? null;
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
	const sidebarMode = useUiStore((state) => state.sidebarMode);
	const effectiveMode: SidebarMode =
		sidebarMode === 'outline' && !showOutlineTab ? 'explorer' : sidebarMode;
	const pinnedPathKeys = new Set(locations.map((location) => comparablePath(location.path)));
	const displayedLocations =
		activeRoot && !pinnedPathKeys.has(comparablePath(activeRoot.path))
			? [...locations, activeRoot]
			: locations;

	return (
		<section className="sidebar-section">
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
					{displayedLocations.map((location) => {
						const locationKey = comparablePath(location.path);
						const isHome = homePath ? locationKey === comparablePath(homePath) : false;
						const isPinned = pinnedPathKeys.has(locationKey);
						const isActive = activeRootPath
							? comparablePath(activeRootPath) === locationKey
							: false;
						const iconName = isHome ? 'Home' : (locationIcons[location.path] ?? 'Folder');
						const LocationIcon = getIconComponent(iconName);
						const pinLabel = isHome
							? 'Home is always pinned'
							: isPinned
								? `Unpin ${location.name}`
								: `Pin ${location.name}`;
						const PinIcon = isPinned ? PinOff : Pin;
						return (
							<div
								className={`saved-location-row ${isActive ? 'active' : ''}`}
								key={location.path}
								onContextMenu={
									isPinned
										? (event) => {
												event.stopPropagation();
												onSavedContextMenu(location, event);
											}
										: undefined
								}
							>
								<button
									type="button"
									className="saved-location-main"
									onClick={() => void onSelectLocation(location)}
								>
									<LocationIcon size={15} />
									<span>{location.name}</span>
								</button>
								<button
									type="button"
									className="saved-location-pin"
									aria-label={pinLabel}
									aria-pressed={isPinned}
									disabled={isHome}
									onClick={() => (isPinned ? onUnpinLocation(location) : onPinLocation(location))}
								>
									<PinIcon size={14} />
								</button>
							</div>
						);
					})}
				</div>
			)}
		</section>
	);
}
