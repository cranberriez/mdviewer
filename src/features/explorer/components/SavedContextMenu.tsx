import type { Entry } from '../../../shared/types/files';
import { ContextMenuSurface } from './context-menu/ContextMenuSurface';
import {
	entriesForSavedLocation,
	type SavedMenuAction,
} from './context-menu/savedContextMenuEntries';

export type { SavedMenuAction };

interface SavedContextMenuProps {
	location: Entry;
	x: number;
	y: number;
	/** Whether this location may be unpinned (Home cannot). */
	canUnpin: boolean;
	onAction: (action: SavedMenuAction, location: Entry) => void;
	onClose: () => void;
}

export function SavedContextMenu({
	location,
	x,
	y,
	canUnpin,
	onAction,
	onClose,
}: SavedContextMenuProps) {
	return (
		<ContextMenuSurface
			x={x}
			y={y}
			entries={entriesForSavedLocation({ canUnpin })}
			keepOpenOn={['change-icon']}
			onSelect={(action) => onAction(action, location)}
			onClose={onClose}
		/>
	);
}
