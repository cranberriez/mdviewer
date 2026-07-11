import {
	Clock3,
	Files,
	FolderOpen,
	ListTree,
	Moon,
	PanelLeftClose,
	PanelLeftOpen,
	Search,
	Sun,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useUiStore } from '../../app-shell/state/useUiStore';
import { IconActionButton } from '../../file-actions/components/IconActionButton';
import { SidebarHeaderActions, type SidebarHeaderActionConfig } from './SidebarHeaderActions';
import type { SidebarMode } from './Sidebar';

interface SidebarActivityRailProps {
	explorerHidden: boolean;
	showOutlineTab: boolean;
	onOpenFolder: () => void;
	onToggleExplorer: () => void;
}

export function SidebarActivityRail({
	explorerHidden,
	showOutlineTab,
	onOpenFolder,
	onToggleExplorer,
}: SidebarActivityRailProps) {
	const { sidebarMode, sourcesHeaderActionsVisible, theme, setSidebarMode, setTheme } = useUiStore(
		useShallow((state) => ({
			sidebarMode: state.sidebarMode,
			sourcesHeaderActionsVisible: state.sourcesHeaderActionsVisible,
			theme: state.theme,
			setSidebarMode: state.setSidebarMode,
			setTheme: state.setTheme,
		}))
	);
	const effectiveMode: SidebarMode =
		sidebarMode === 'outline' && !showOutlineTab ? 'explorer' : sidebarMode;

	const selectMode = (mode: SidebarMode) => {
		if (mode === effectiveMode) {
			onToggleExplorer();
			return;
		}
		setSidebarMode(mode);
		if (explorerHidden) {
			onToggleExplorer();
		}
	};

	const viewActions: SidebarHeaderActionConfig[] = [
		{
			id: 'explorer',
			icon: Files,
			tooltip: 'Explorer',
			active: effectiveMode === 'explorer',
			role: 'tab',
			ariaSelected: effectiveMode === 'explorer',
			onClick: () => selectMode('explorer'),
		},
		{
			id: 'search',
			icon: Search,
			tooltip: 'Search files',
			visible: sourcesHeaderActionsVisible.search,
			active: effectiveMode === 'search',
			role: 'tab',
			ariaSelected: effectiveMode === 'search',
			onClick: () => selectMode('search'),
		},
		{
			id: 'recent',
			icon: Clock3,
			tooltip: 'Recent',
			active: effectiveMode === 'recent',
			role: 'tab',
			ariaSelected: effectiveMode === 'recent',
			onClick: () => selectMode('recent'),
		},
		{
			id: 'outline',
			icon: ListTree,
			tooltip: 'Outline',
			visible: showOutlineTab && sourcesHeaderActionsVisible.outline,
			active: effectiveMode === 'outline',
			role: 'tab',
			ariaSelected: effectiveMode === 'outline',
			onClick: () => selectMode('outline'),
		},
	];
	const ToggleIcon = explorerHidden ? PanelLeftOpen : PanelLeftClose;
	const toggleLabel = explorerHidden ? 'Open navigation' : 'Close navigation';
	const ThemeIcon = theme === 'light' ? Moon : Sun;
	const themeLabel = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';

	return (
		<nav className="sidebar-activity-rail" aria-label="Sidebar navigation">
			<div className="sidebar-activity-tabs" role="tablist" aria-label="Sidebar view">
				<SidebarHeaderActions
					actions={viewActions}
					baseClassName="sidebar-activity-button"
					iconSize={16}
					showNativeTitles={false}
					tooltipPlacement="right"
				/>
			</div>
			<div className="sidebar-activity-actions" role="group" aria-label="Workspace controls">
				<IconActionButton
					className="sidebar-activity-button"
					tooltip="Open folder"
					tooltipPlacement="right"
					onClick={onOpenFolder}
				>
					<FolderOpen size={16} />
				</IconActionButton>
				<IconActionButton
					className="sidebar-activity-button"
					tooltip={themeLabel}
					tooltipPlacement="right"
					onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
				>
					<ThemeIcon size={16} />
				</IconActionButton>
				<IconActionButton
					className="sidebar-activity-button sidebar-activity-toggle"
					tooltip={toggleLabel}
					tooltipPlacement="right"
					aria-label={toggleLabel}
					aria-expanded={!explorerHidden}
					onClick={onToggleExplorer}
				>
					<ToggleIcon size={16} />
				</IconActionButton>
			</div>
		</nav>
	);
}
