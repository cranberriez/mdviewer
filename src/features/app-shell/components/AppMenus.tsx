import type { Entry } from '../../../shared/types/files';
import type {
	ExplorerHeaderActionsVisibility,
	SourcesHeaderActionsVisibility,
} from '../../../shared/state/persistence';
import {
	ContextMenu,
	type ContextMenuAction,
	type ContextMenuTarget,
	type ContextMenuVariant,
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

interface PositionedMenu {
	x: number;
	y: number;
}

interface PositionedLocation extends PositionedMenu {
	location: Entry;
}

interface AppMenusProps {
	context: {
		target: ContextMenuTarget | null;
		variant: ContextMenuVariant;
		canPin: boolean;
		onAction: (action: ContextMenuAction, target: ContextMenuTarget) => void;
		onClose: () => void;
	};
	explorerHeader: {
		menu: PositionedMenu | null;
		visibleActions: ExplorerHeaderActionsVisibility;
		onAction: (action: ExplorerHeaderMenuAction) => void;
		onClose: () => void;
	};
	sourcesHeader: {
		menu: PositionedMenu | null;
		visibleActions: SourcesHeaderActionsVisibility;
		showOutlineAction: boolean;
		rootPinned: boolean;
		rootPinDisabled: boolean;
		onAction: (action: SourcesHeaderMenuAction) => void;
		onClose: () => void;
	};
	saved: {
		menu: PositionedLocation | null;
		canUnpin: (location: Entry) => boolean;
		onAction: (action: SavedMenuAction, location: Entry) => void;
		onClose: () => void;
	};
	iconPicker: {
		menu: PositionedLocation | null;
		currentIcon?: string;
		onSelect: (iconName: string) => void;
		onClose: () => void;
	};
}

export function AppMenus({
	context,
	explorerHeader,
	sourcesHeader,
	saved,
	iconPicker,
}: AppMenusProps) {
	return (
		<>
			{context.target ? (
				<ContextMenu
					target={context.target}
					variant={context.variant}
					canPin={context.canPin}
					onAction={context.onAction}
					onClose={context.onClose}
				/>
			) : null}

			{explorerHeader.menu ? (
				<ExplorerHeaderContextMenu
					x={explorerHeader.menu.x}
					y={explorerHeader.menu.y}
					visibleActions={explorerHeader.visibleActions}
					onAction={explorerHeader.onAction}
					onClose={explorerHeader.onClose}
				/>
			) : null}

			{sourcesHeader.menu ? (
				<SourcesHeaderContextMenu
					x={sourcesHeader.menu.x}
					y={sourcesHeader.menu.y}
					visibleActions={sourcesHeader.visibleActions}
					showOutlineAction={sourcesHeader.showOutlineAction}
					rootPinned={sourcesHeader.rootPinned}
					rootPinDisabled={sourcesHeader.rootPinDisabled}
					onAction={sourcesHeader.onAction}
					onClose={sourcesHeader.onClose}
				/>
			) : null}

			{saved.menu ? (
				<SavedContextMenu
					location={saved.menu.location}
					x={saved.menu.x}
					y={saved.menu.y}
					canUnpin={saved.canUnpin(saved.menu.location)}
					onAction={saved.onAction}
					onClose={saved.onClose}
				/>
			) : null}

			{iconPicker.menu ? (
				<IconPickerMenu
					x={iconPicker.menu.x}
					y={iconPicker.menu.y}
					currentIcon={iconPicker.currentIcon}
					onSelect={iconPicker.onSelect}
					onClose={iconPicker.onClose}
				/>
			) : null}
		</>
	);
}
