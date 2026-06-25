import { FilePlus, FolderPlus, RefreshCw } from 'lucide-react';
import type { ExplorerHeaderActionsVisibility } from '../../../../shared/state/persistence';
import { ContextMenuSurface } from './ContextMenuSurface';
import type { MenuEntry } from './ContextMenuSurface';

export type ExplorerHeaderMenuAction =
	| 'new-file'
	| 'new-folder'
	| 'refresh'
	| 'toggle-new-file'
	| 'toggle-new-folder'
	| 'toggle-refresh';

interface ExplorerHeaderContextMenuProps {
	x: number;
	y: number;
	visibleActions: ExplorerHeaderActionsVisibility;
	onAction: (action: ExplorerHeaderMenuAction) => void;
	onClose: () => void;
}

function entriesForExplorerHeader(
	visibleActions: ExplorerHeaderActionsVisibility
): MenuEntry<ExplorerHeaderMenuAction>[] {
	return [
		{ id: 'new-file', label: 'Add File', icon: FilePlus },
		{ id: 'new-folder', label: 'Add Folder', icon: FolderPlus },
		{ id: 'refresh', label: 'Refresh', icon: RefreshCw },
		{ separator: true },
		{
			id: 'toggle-new-file',
			label: 'Show Add File Button',
			checked: visibleActions.newFile,
		},
		{
			id: 'toggle-new-folder',
			label: 'Show Add Folder Button',
			checked: visibleActions.newFolder,
		},
		{
			id: 'toggle-refresh',
			label: 'Show Refresh Button',
			checked: visibleActions.refresh,
		},
	];
}

export function ExplorerHeaderContextMenu({
	x,
	y,
	visibleActions,
	onAction,
	onClose,
}: ExplorerHeaderContextMenuProps) {
	return (
		<ContextMenuSurface
			x={x}
			y={y}
			entries={entriesForExplorerHeader(visibleActions)}
			onSelect={onAction}
			onClose={onClose}
		/>
	);
}
