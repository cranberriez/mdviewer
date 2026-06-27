import { useShallow } from 'zustand/react/shallow';
import type { Entry } from '../../../shared/types/files';
import type {
	ExplorerHeaderActionsVisibility,
	SourcesHeaderActionsVisibility,
} from '../../../shared/state/persistence';
import {
	ContextMenu,
	type ContextMenuAction,
	type ContextMenuTarget,
} from '../../explorer/components/ContextMenu';
import {
	ExplorerHeaderContextMenu,
	type ExplorerHeaderMenuAction,
} from '../../explorer/components/context-menu/ExplorerHeaderContextMenu';
import {
	SourcesHeaderContextMenu,
	type SourcesHeaderMenuAction,
} from '../../explorer/components/context-menu/SourcesHeaderContextMenu';
import { SavedContextMenu, type SavedMenuAction } from '../../explorer/components/SavedContextMenu';
import { IconPickerMenu } from '../../explorer/components/IconPickerMenu';
import { selectMenuTargets, useMenuStore } from '../state/useMenuStore';
import { useSavedLocationsStore } from '../../saved-locations/state/useSavedLocationsStore';

interface AppMenusProps {
	context: {
		canPin: boolean;
		onAction: (action: ContextMenuAction, target: ContextMenuTarget) => void;
	};
	explorerHeader: {
		visibleActions: ExplorerHeaderActionsVisibility;
		onAction: (action: ExplorerHeaderMenuAction) => void;
	};
	sourcesHeader: {
		visibleActions: SourcesHeaderActionsVisibility;
		showOutlineAction: boolean;
		rootPinned: boolean;
		rootPinDisabled: boolean;
		onAction: (action: SourcesHeaderMenuAction) => void;
	};
	saved: {
		canUnpin: (location: Entry) => boolean;
		onAction: (action: SavedMenuAction, location: Entry) => void;
	};
	iconPicker: {
		onSelect: (iconName: string) => void;
	};
}

export function AppMenus({
	context,
	explorerHeader,
	sourcesHeader,
	saved,
	iconPicker,
}: AppMenusProps) {
	const {
		contextMenu,
		contextMenuVariant,
		explorerHeaderMenu,
		iconPicker: iconPickerMenu,
		savedMenu,
		sourcesHeaderMenu,
	} = useMenuStore(useShallow(selectMenuTargets));
	const closeContextMenu = useMenuStore((state) => state.closeContextMenu);
	const closeExplorerHeaderMenu = useMenuStore((state) => state.closeExplorerHeaderMenu);
	const closeIconPicker = useMenuStore((state) => state.closeIconPicker);
	const closeSavedMenu = useMenuStore((state) => state.closeSavedMenu);
	const closeSourcesHeaderMenu = useMenuStore((state) => state.closeSourcesHeaderMenu);
	const currentIcon = useSavedLocationsStore((state) =>
		iconPickerMenu ? state.locationIcons[iconPickerMenu.location.path] : undefined
	);

	return (
		<>
			{contextMenu ? (
				<ContextMenu
					target={contextMenu}
					variant={contextMenuVariant}
					canPin={context.canPin}
					onAction={context.onAction}
					onClose={closeContextMenu}
				/>
			) : null}

			{explorerHeaderMenu ? (
				<ExplorerHeaderContextMenu
					x={explorerHeaderMenu.x}
					y={explorerHeaderMenu.y}
					visibleActions={explorerHeader.visibleActions}
					onAction={explorerHeader.onAction}
					onClose={closeExplorerHeaderMenu}
				/>
			) : null}

			{sourcesHeaderMenu ? (
				<SourcesHeaderContextMenu
					x={sourcesHeaderMenu.x}
					y={sourcesHeaderMenu.y}
					visibleActions={sourcesHeader.visibleActions}
					showOutlineAction={sourcesHeader.showOutlineAction}
					rootPinned={sourcesHeader.rootPinned}
					rootPinDisabled={sourcesHeader.rootPinDisabled}
					onAction={sourcesHeader.onAction}
					onClose={closeSourcesHeaderMenu}
				/>
			) : null}

			{savedMenu ? (
				<SavedContextMenu
					location={savedMenu.location}
					x={savedMenu.x}
					y={savedMenu.y}
					canUnpin={saved.canUnpin(savedMenu.location)}
					onAction={saved.onAction}
					onClose={closeSavedMenu}
				/>
			) : null}

			{iconPickerMenu ? (
				<IconPickerMenu
					x={iconPickerMenu.x}
					y={iconPickerMenu.y}
					currentIcon={currentIcon}
					onSelect={iconPicker.onSelect}
					onClose={closeIconPicker}
				/>
			) : null}
		</>
	);
}
