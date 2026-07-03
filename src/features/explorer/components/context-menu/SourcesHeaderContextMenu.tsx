import { Folder, FolderOpen, List, Pin, PinOff, Search } from 'lucide-react';
import type { SourcesHeaderActionsVisibility } from '../../../../shared/state/persistence';
import { ContextMenuSurface } from './ContextMenuSurface';
import type { MenuEntry } from './ContextMenuSurface';

export type SourcesHeaderMenuAction =
	| 'switch-explorer'
	| 'switch-search'
	| 'switch-outline'
	| 'toggle-root-pin'
	| 'open-folder'
	| 'toggle-search'
	| 'toggle-outline'
	| 'toggle-pin';

interface SourcesHeaderContextMenuProps {
	x: number;
	y: number;
	visibleActions: SourcesHeaderActionsVisibility;
	showOutlineAction: boolean;
	rootPinned: boolean;
	rootPinDisabled: boolean;
	onAction: (action: SourcesHeaderMenuAction) => void;
	onClose: () => void;
}

function entriesForSourcesHeader({
	visibleActions,
	showOutlineAction,
	rootPinned,
	rootPinDisabled,
}: Pick<
	SourcesHeaderContextMenuProps,
	'visibleActions' | 'showOutlineAction' | 'rootPinned' | 'rootPinDisabled'
>): MenuEntry<SourcesHeaderMenuAction>[] {
	return [
		{ id: 'switch-explorer', label: 'Switch to Explorer', icon: Folder },
		{ id: 'switch-search', label: 'Switch to Search', icon: Search },
		...(showOutlineAction
			? ([{ id: 'switch-outline', label: 'Switch to Outline', icon: List }] as MenuEntry<SourcesHeaderMenuAction>[])
			: []),
		{
			id: 'toggle-root-pin',
			label: rootPinned ? 'Unpin Current Root' : 'Pin Current Root',
			icon: rootPinned ? PinOff : Pin,
			disabled: rootPinDisabled,
		},
		{ id: 'open-folder', label: 'Open Folder…', icon: FolderOpen },
		{ separator: true },
		{
			id: 'toggle-search',
			label: 'Show Search Button',
			checked: visibleActions.search,
		},
		{
			id: 'toggle-outline',
			label: 'Show Outline Button',
			checked: visibleActions.outline,
		},
		{
			id: 'toggle-pin',
			label: 'Show Pin Button',
			checked: visibleActions.pin,
		},
	];
}

export function SourcesHeaderContextMenu({
	x,
	y,
	visibleActions,
	showOutlineAction,
	rootPinned,
	rootPinDisabled,
	onAction,
	onClose,
}: SourcesHeaderContextMenuProps) {
	return (
		<ContextMenuSurface
			x={x}
			y={y}
			entries={entriesForSourcesHeader({
				visibleActions,
				showOutlineAction,
				rootPinned,
				rootPinDisabled,
			})}
			onSelect={onAction}
			onClose={onClose}
		/>
	);
}
