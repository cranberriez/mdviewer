import type { MouseEvent as ReactMouseEvent } from 'react';
import { FilePlus, FolderPlus, RefreshCw } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useUiStore } from '../../app-shell/state/useUiStore';
import { SidebarHeaderActions, type SidebarHeaderActionConfig } from './SidebarHeaderActions';
import { useExplorerStore } from '../state/useExplorerStore';

interface SidebarExplorerHeaderProps {
	showingOutline: boolean;
	showingSearchResults: boolean;
	onCreateRootFile: () => void;
	onCreateRootFolder: () => void;
	onExplorerHeaderContextMenu: (event: ReactMouseEvent) => void;
	onRefreshRoot: () => void;
}

export function SidebarExplorerHeader({
	showingOutline,
	showingSearchResults,
	onCreateRootFile,
	onCreateRootFolder,
	onExplorerHeaderContextMenu,
	onRefreshRoot,
}: SidebarExplorerHeaderProps) {
	const { activeRoot, loadingPaths } = useExplorerStore(
		useShallow((state) => ({
			activeRoot: state.activeRoot,
			loadingPaths: state.loadingPaths,
		}))
	);
	const explorerHeaderActionsVisible = useUiStore((state) => state.explorerHeaderActionsVisible);
	const rootRefreshing = activeRoot ? loadingPaths.has(activeRoot.path) : false;
	const explorerHeaderActions: SidebarHeaderActionConfig[] = [
		{
			id: 'new-file',
			icon: FilePlus,
			tooltip: 'Add file',
			visible: explorerHeaderActionsVisible.newFile,
			onClick: onCreateRootFile,
		},
		{
			id: 'new-folder',
			icon: FolderPlus,
			tooltip: 'Add folder',
			visible: explorerHeaderActionsVisible.newFolder,
			onClick: onCreateRootFolder,
		},
		{
			id: 'refresh',
			icon: RefreshCw,
			tooltip: 'Refresh explorer',
			visible: explorerHeaderActionsVisible.refresh,
			disabled: rootRefreshing,
			iconClassName: rootRefreshing ? 'search-spinner' : undefined,
			onClick: onRefreshRoot,
		},
	];
	const showActions = !showingSearchResults && !showingOutline && activeRoot;

	return (
		<div
			className="explorer-heading"
			onContextMenu={showActions ? onExplorerHeaderContextMenu : undefined}
		>
			<div>
				<div className="section-label">
					{showingOutline ? 'Outline' : showingSearchResults ? 'Search' : 'Explorer'}
				</div>
			</div>
			{showActions ? (
				<div className="explorer-actions">
					<SidebarHeaderActions
						actions={explorerHeaderActions}
						baseClassName="explorer-header-action"
						iconSize={14}
					/>
				</div>
			) : null}
		</div>
	);
}
