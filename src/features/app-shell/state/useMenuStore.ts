import { create } from 'zustand';
import type { Entry } from '../../../shared/types/files';
import type { RecentItem } from '../../../shared/state/persistence';
import type { ContextMenuTarget, ContextMenuVariant } from '../../explorer/components/ContextMenu';
import type { PositionedMenu } from '../../explorer/components/context-menu/menuPosition';

interface PositionedLocation extends PositionedMenu {
	location: Entry;
}

interface MenuState {
	contextMenu: ContextMenuTarget | null;
	contextMenuRecent: RecentItem | null;
	contextMenuVariant: ContextMenuVariant;
	explorerHeaderMenu: PositionedMenu | null;
	iconPicker: PositionedLocation | null;
	savedMenu: PositionedLocation | null;
	sourcesHeaderMenu: PositionedMenu | null;
}

interface MenuActions {
	closeContextMenu: () => void;
	closeExplorerHeaderMenu: () => void;
	closeIconPicker: () => void;
	closeSavedMenu: () => void;
	closeSourcesHeaderMenu: () => void;
	openContextMenu: (
		target: ContextMenuTarget,
		options?: { variant?: ContextMenuVariant; recent?: RecentItem | null }
	) => void;
	openExplorerHeaderMenu: (menu: PositionedMenu) => void;
	openIconPicker: (menu: PositionedLocation) => void;
	openSavedMenu: (menu: PositionedLocation) => void;
	openSourcesHeaderMenu: (menu: PositionedMenu) => void;
	resetMenus: () => void;
}

export type MenuStore = MenuState & MenuActions;

export const useMenuStore = create<MenuStore>()((set) => ({
	contextMenu: null,
	contextMenuRecent: null,
	contextMenuVariant: 'explorer',
	explorerHeaderMenu: null,
	iconPicker: null,
	savedMenu: null,
	sourcesHeaderMenu: null,

	closeContextMenu: () =>
		set({
			contextMenu: null,
			contextMenuRecent: null,
			contextMenuVariant: 'explorer',
		}),
	closeExplorerHeaderMenu: () => set({ explorerHeaderMenu: null }),
	closeIconPicker: () => set({ iconPicker: null }),
	closeSavedMenu: () => set({ savedMenu: null }),
	closeSourcesHeaderMenu: () => set({ sourcesHeaderMenu: null }),
	openContextMenu: (target, options) =>
		set({
			contextMenu: target,
			contextMenuRecent: options?.recent ?? null,
			contextMenuVariant: options?.variant ?? 'explorer',
			explorerHeaderMenu: null,
			savedMenu: null,
			sourcesHeaderMenu: null,
		}),
	openExplorerHeaderMenu: (explorerHeaderMenu) =>
		set({
			contextMenu: null,
			contextMenuRecent: null,
			contextMenuVariant: 'explorer',
			explorerHeaderMenu,
			savedMenu: null,
			sourcesHeaderMenu: null,
		}),
	openIconPicker: (iconPicker) => set({ iconPicker }),
	openSavedMenu: (savedMenu) =>
		set({
			contextMenu: null,
			explorerHeaderMenu: null,
			savedMenu,
			sourcesHeaderMenu: null,
		}),
	openSourcesHeaderMenu: (sourcesHeaderMenu) =>
		set({
			contextMenu: null,
			contextMenuRecent: null,
			contextMenuVariant: 'explorer',
			explorerHeaderMenu: null,
			savedMenu: null,
			sourcesHeaderMenu,
		}),
	resetMenus: () =>
		set({
			contextMenu: null,
			contextMenuRecent: null,
			contextMenuVariant: 'explorer',
			explorerHeaderMenu: null,
			iconPicker: null,
			savedMenu: null,
			sourcesHeaderMenu: null,
		}),
}));

export const selectMenuTargets = (state: MenuStore) => ({
	contextMenu: state.contextMenu,
	contextMenuRecent: state.contextMenuRecent,
	contextMenuVariant: state.contextMenuVariant,
	explorerHeaderMenu: state.explorerHeaderMenu,
	iconPicker: state.iconPicker,
	savedMenu: state.savedMenu,
	sourcesHeaderMenu: state.sourcesHeaderMenu,
});
