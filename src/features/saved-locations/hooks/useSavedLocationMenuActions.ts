import { useCallback } from 'react';
import type { Entry } from '../../../shared/types/files';
import { relativePath } from '../../../shared/utils/path';
import { revealInExplorer } from '../../files/api/filesApi';
import type { SavedMenuAction } from '../../explorer/components/SavedContextMenu';
import { useExplorerStore } from '../../explorer/state/useExplorerStore';
import { useMenuStore } from '../../app-shell/state/useMenuStore';

interface UseSavedLocationMenuActionsOptions {
	applyLocationIcon: (location: Entry, iconName: string) => void;
	unpinLocation: (location: Entry) => void;
}

export function useSavedLocationMenuActions({
	applyLocationIcon,
	unpinLocation,
}: UseSavedLocationMenuActionsOptions) {
	const activeRoot = useExplorerStore((state) => state.activeRoot);
	const closeSavedMenu = useMenuStore((state) => state.closeSavedMenu);
	const iconPicker = useMenuStore((state) => state.iconPicker);
	const openIconPicker = useMenuStore((state) => state.openIconPicker);
	const savedMenu = useMenuStore((state) => state.savedMenu);
	const setError = useExplorerStore((state) => state.setError);

	const handleSavedAction = useCallback(
		async (action: SavedMenuAction, location: Entry) => {
			if (action === 'change-icon') {
				const menu = savedMenu;
				closeSavedMenu();
				if (menu) {
					openIconPicker({ location, x: menu.x + 240, y: menu.y });
				}
				return;
			}

			closeSavedMenu();

			try {
				switch (action) {
					case 'reveal':
						await revealInExplorer(location.path);
						break;
					case 'copy-path':
						await navigator.clipboard?.writeText(location.path);
						break;
					case 'copy-relative-path':
						await navigator.clipboard?.writeText(
							activeRoot ? relativePath(activeRoot.path, location.path) : location.path
						);
						break;
					case 'unpin':
						unpinLocation(location);
						break;
					default:
						break;
				}
			} catch (cause) {
				setError(`${String(cause)}`);
			}
		},
		[activeRoot, closeSavedMenu, openIconPicker, savedMenu, setError, unpinLocation]
	);

	const handleIconSelect = useCallback(
		(iconName: string) => {
			if (iconPicker) {
				applyLocationIcon(iconPicker.location, iconName);
			}
		},
		[applyLocationIcon, iconPicker]
	);

	return { handleIconSelect, handleSavedAction };
}
