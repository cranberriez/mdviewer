import { CornerUpLeft, Link2, Palette, PinOff } from 'lucide-react';
import type { MenuEntry } from './ContextMenuSurface';

export type SavedMenuAction =
	| 'reveal'
	| 'copy-path'
	| 'copy-relative-path'
	| 'change-icon'
	| 'unpin';

interface SavedLocationEntryOptions {
	canUnpin: boolean;
}

export function entriesForSavedLocation({
	canUnpin,
}: SavedLocationEntryOptions): MenuEntry<SavedMenuAction>[] {
	return [
		{
			id: 'reveal',
			label: 'Reveal in File Explorer',
			icon: CornerUpLeft,
			shortcut: 'Shift+Alt+R',
		},
		{
			id: 'copy-path',
			label: 'Copy Path',
			icon: Link2,
			shortcut: 'Shift+Alt+C',
		},
		{
			id: 'copy-relative-path',
			label: 'Copy Relative Path',
			icon: Link2,
		},
		{
			id: 'change-icon',
			label: 'Change Icon',
			icon: Palette,
			disabled: !canUnpin,
			title: canUnpin ? undefined : 'Home icon cannot be changed',
		},
		{ separator: true },
		{
			id: 'unpin',
			label: 'Unpin',
			icon: PinOff,
			disabled: !canUnpin,
			title: canUnpin ? undefined : "Home can't be unpinned",
		},
	];
}
