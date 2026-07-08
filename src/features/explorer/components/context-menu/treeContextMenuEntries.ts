import {
	Copy,
	CornerUpLeft,
	FilePlus,
	FolderPlus,
	Link2,
	Pencil,
	Pin,
	Scissors,
	SquareArrowOutUpRight,
	TerminalSquare,
	Trash2,
	X,
} from 'lucide-react';
import type { MenuEntry, MenuItem } from './ContextMenuSurface';

export type ContextMenuTargetKind = 'folder' | 'file';

export type ContextMenuAction =
	| 'new-file'
	| 'new-folder'
	| 'pin'
	| 'open'
	| 'reveal'
	| 'copy-path'
	| 'copy-relative-path'
	| 'rename'
	| 'delete'
	| 'remove-recent';

export type ContextMenuVariant = 'explorer' | 'recent-file' | 'recent-root';

const PENDING_CUT: MenuItem<ContextMenuAction> = {
	id: 'copy-path',
	label: 'Cut',
	icon: Scissors,
	shortcut: 'Ctrl+X',
	disabled: true,
};

const PENDING_COPY: MenuItem<ContextMenuAction> = {
	id: 'copy-path',
	label: 'Copy',
	icon: Copy,
	shortcut: 'Ctrl+C',
	disabled: true,
};

export const PENDING_CLIPBOARD_ENTRIES: MenuEntry<ContextMenuAction>[] = [
	PENDING_CUT,
	PENDING_COPY,
];

export const PATH_COPY_ENTRIES: MenuEntry<ContextMenuAction>[] = [
	{ id: 'copy-path', label: 'Copy Path', icon: Link2, shortcut: 'Shift+Alt+C' },
	{
		id: 'copy-relative-path',
		label: 'Copy Relative Path',
		icon: Link2,
		shortcut: 'Ctrl+K Ctrl+Shift+C',
	},
];

export const RENAME_DELETE_ENTRIES: MenuEntry<ContextMenuAction>[] = [
	{ id: 'rename', label: 'Rename…', icon: Pencil, shortcut: 'F2' },
	{ id: 'delete', label: 'Delete', icon: Trash2, shortcut: 'Del', danger: true },
];

export const REMOVE_RECENT_ENTRY: MenuItem<ContextMenuAction> = {
	id: 'remove-recent',
	label: 'Remove from Recent',
	icon: X,
};

export const ROOT_CREATE_ENTRIES: MenuEntry<ContextMenuAction>[] = [
	{ id: 'new-file', label: 'New File…', icon: FilePlus },
	{ id: 'new-folder', label: 'New Folder…', icon: FolderPlus },
];

const COMMON_TAIL: MenuEntry<ContextMenuAction>[] = [
	...PENDING_CLIPBOARD_ENTRIES,
	{ separator: true },
	...PATH_COPY_ENTRIES,
	{ separator: true },
	...RENAME_DELETE_ENTRIES,
];

interface TreeContextMenuRequest {
	kind: ContextMenuTargetKind;
	canPin: boolean;
	variant: ContextMenuVariant;
}

export function entriesForTreeContext({
	kind,
	canPin,
	variant,
}: TreeContextMenuRequest): MenuEntry<ContextMenuAction>[] {
	if (variant === 'recent-file') {
		return [
			{ id: 'open', label: 'Open', icon: SquareArrowOutUpRight, shortcut: 'Enter' },
			{ separator: true },
			{ id: 'reveal', label: 'Reveal in File Explorer', icon: CornerUpLeft },
			{ id: 'copy-path', label: 'Copy Path', icon: Link2 },
			{ separator: true },
			{ id: 'rename', label: 'Rename…', icon: Pencil },
			{ id: 'delete', label: 'Delete', icon: Trash2, danger: true },
			{ separator: true },
			REMOVE_RECENT_ENTRY,
		];
	}

	if (variant === 'recent-root') {
		return [
			{ id: 'reveal', label: 'Reveal in File Explorer', icon: CornerUpLeft },
			{ id: 'copy-path', label: 'Copy Path', icon: Link2 },
			{ separator: true },
			{ id: 'rename', label: 'Rename…', icon: Pencil },
			{ id: 'delete', label: 'Delete', icon: Trash2, danger: true },
			{ separator: true },
			REMOVE_RECENT_ENTRY,
		];
	}

	if (kind === 'folder') {
		return [
			...ROOT_CREATE_ENTRIES,
			{ separator: true },
			...(canPin
				? ([{ id: 'pin', label: 'Pin Folder', icon: Pin }, { separator: true }] as MenuEntry<ContextMenuAction>[])
				: []),
			{
				id: 'reveal',
				label: 'Reveal in File Explorer',
				icon: CornerUpLeft,
				shortcut: 'Shift+Alt+R',
			},
			{
				id: 'open',
				label: 'Open in Terminal',
				icon: TerminalSquare,
				disabled: true,
			},
			{ separator: true },
			...COMMON_TAIL,
		];
	}

	return [
		{ id: 'open', label: 'Open', icon: SquareArrowOutUpRight, shortcut: 'Enter' },
		{ separator: true },
		{ id: 'reveal', label: 'Reveal in File Explorer', icon: CornerUpLeft, shortcut: 'Shift+Alt+R' },
		{ separator: true },
		...COMMON_TAIL,
	];
}
