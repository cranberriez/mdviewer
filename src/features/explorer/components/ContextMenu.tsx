import {
	ContextMenuSurface,
	type MenuEntry,
	type MenuItem,
	type MenuSeparator,
	isSeparator,
} from './context-menu/ContextMenuSurface';
import {
	entriesForTreeContext,
	type ContextMenuAction,
	type ContextMenuTargetKind,
	type ContextMenuVariant,
} from './context-menu/treeContextMenuEntries';

export type {
	ContextMenuAction,
	ContextMenuTargetKind,
	ContextMenuVariant,
	MenuEntry,
	MenuItem,
	MenuSeparator,
};

export { isSeparator };

export interface ContextMenuTarget {
	kind: ContextMenuTargetKind;
	path: string;
	name: string;
	/** Anchor coordinates (viewport pixels) where the menu should open. */
	x: number;
	y: number;
}

interface ContextMenuProps {
	target: ContextMenuTarget;
	/** Whether the "Pin Folder" item should appear (folders not already pinned). */
	canPin?: boolean;
	/** Origin of the menu, which trims the action set. Defaults to "explorer". */
	variant?: ContextMenuVariant;
	onAction: (action: ContextMenuAction, target: ContextMenuTarget) => void;
	onClose: () => void;
}

export function ContextMenu({
	target,
	canPin = false,
	variant = 'explorer',
	onAction,
	onClose,
}: ContextMenuProps) {
	const entries = entriesForTreeContext({
		kind: target.kind,
		canPin,
		variant,
	});

	return (
		<ContextMenuSurface
			x={target.x}
			y={target.y}
			entries={entries}
			onSelect={(action) => onAction(action, target)}
			onClose={onClose}
		/>
	);
}
