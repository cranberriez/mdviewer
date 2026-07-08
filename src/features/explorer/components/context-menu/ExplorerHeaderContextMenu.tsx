import { FilePlus, FolderPlus, RefreshCw } from 'lucide-react';
import type {
	ExplorerFilterOptions,
	ExplorerHeaderActionsVisibility,
} from '../../../../shared/state/persistence';
import { ContextMenuSurface } from './ContextMenuSurface';
import type { MenuEntry } from './ContextMenuSurface';

export type ExplorerHeaderMenuAction =
	| 'new-file'
	| 'new-folder'
	| 'refresh'
	| 'toggle-new-file'
	| 'toggle-new-folder'
	| 'toggle-refresh'
	| 'toggle-hidden-items'
	| 'toggle-non-text-files';

interface ExplorerHeaderContextMenuProps {
	x: number;
	y: number;
	filters: ExplorerFilterOptions;
	visibleActions: ExplorerHeaderActionsVisibility;
	onAction: (action: ExplorerHeaderMenuAction) => void;
	onClose: () => void;
}

function entriesForExplorerHeader({
	filters,
	visibleActions,
}: Pick<
	ExplorerHeaderContextMenuProps,
	'filters' | 'visibleActions'
>): MenuEntry<ExplorerHeaderMenuAction>[] {
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
		{ separator: true },
		{
			id: 'toggle-hidden-items',
			label: 'Show Hidden Items',
			checked: filters.showHiddenItems,
		},
		{
			id: 'toggle-non-text-files',
			label: 'Show Non-Text Files',
			checked: filters.showNonTextFiles,
		},
	];
}

export function ExplorerHeaderContextMenu({
	x,
	y,
	filters,
	visibleActions,
	onAction,
	onClose,
}: ExplorerHeaderContextMenuProps) {
	return (
		<ContextMenuSurface
			x={x}
			y={y}
			entries={entriesForExplorerHeader({ filters, visibleActions })}
			onSelect={onAction}
			onClose={onClose}
		/>
	);
}
