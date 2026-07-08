import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { SidebarMode } from '../../explorer/components/Sidebar';
import { DEFAULT_SIDEBAR_WIDTH, clampSidebarWidth } from '../../explorer/hooks/useSidebarResize';
import type { FileViewMode } from '../../file-actions/components/FileActionControls';
import type { MarkdownAction } from '../../preview/markdownActions';
import {
	DEFAULT_EXPLORER_HEADER_ACTIONS_VISIBLE,
	DEFAULT_EXPLORER_FILTERS,
	DEFAULT_SOURCES_HEADER_ACTIONS_VISIBLE,
	type AppConfigurationState,
	type AppTheme,
	type ExplorerFilterOptions,
	type ExplorerHeaderActionsVisibility,
	type SourcesHeaderActionsVisibility,
	type StoredWindowFrame,
} from '../../../shared/state/persistence';

export type AppOverlay = 'onboarding' | 'home' | null;

type Updater<T> = T | ((current: T) => T);

function resolveUpdater<T>(current: T, updater: Updater<T>) {
	return typeof updater === 'function' ? (updater as (current: T) => T)(current) : updater;
}

interface PendingFormatAction {
	action: MarkdownAction;
	id: number;
}

interface UiState {
	barMerged: boolean;
	explorerFilters: ExplorerFilterOptions;
	explorerHeaderActionsVisible: ExplorerHeaderActionsVisibility;
	explorerHidden: boolean;
	mode: FileViewMode;
	outlinePanelVisible: boolean;
	overlay: AppOverlay;
	pendingFormatAction: PendingFormatAction | null;
	sidebarMode: SidebarMode;
	sidebarWidth: number;
	sourcesHeaderActionsVisible: SourcesHeaderActionsVisibility;
	theme: AppTheme;
	windowFrame?: StoredWindowFrame;
}

interface UiActions {
	hydrate: (configuration: Partial<AppConfigurationState>) => void;
	setBarMerged: (updater: Updater<boolean>) => void;
	setExplorerFilters: (updater: Updater<ExplorerFilterOptions>) => void;
	setExplorerHeaderActionsVisible: (updater: Updater<ExplorerHeaderActionsVisibility>) => void;
	setExplorerHidden: (updater: Updater<boolean>) => void;
	setMode: (mode: FileViewMode) => void;
	setOutlinePanelVisible: (updater: Updater<boolean>) => void;
	setOverlay: (overlay: AppOverlay) => void;
	setPendingFormatAction: (updater: Updater<PendingFormatAction | null>) => void;
	setSidebarMode: (mode: SidebarMode) => void;
	setSidebarWidth: (width: number) => void;
	setSourcesHeaderActionsVisible: (updater: Updater<SourcesHeaderActionsVisibility>) => void;
	setTheme: (updater: Updater<AppTheme>) => void;
	setWindowFrame: (frame: StoredWindowFrame | undefined) => void;
	toggleExplorerFilter: (filter: keyof ExplorerFilterOptions) => void;
	toggleExplorerHeaderAction: (action: keyof ExplorerHeaderActionsVisibility) => void;
	toggleSourcesHeaderAction: (action: keyof SourcesHeaderActionsVisibility) => void;
}

export type UiStore = UiState & UiActions;

export const useUiStore = create<UiStore>()((set) => ({
	barMerged: false,
	explorerFilters: DEFAULT_EXPLORER_FILTERS,
	explorerHeaderActionsVisible: DEFAULT_EXPLORER_HEADER_ACTIONS_VISIBLE,
	explorerHidden: false,
	mode: 'preview',
	outlinePanelVisible: false,
	overlay: 'onboarding',
	pendingFormatAction: null,
	sidebarMode: 'explorer',
	sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
	sourcesHeaderActionsVisible: DEFAULT_SOURCES_HEADER_ACTIONS_VISIBLE,
	theme: 'dark',
	windowFrame: undefined,

	hydrate: (configuration) =>
		set({
			barMerged: configuration.barMerged ?? false,
			explorerFilters: configuration.explorerFilters ?? DEFAULT_EXPLORER_FILTERS,
			explorerHeaderActionsVisible:
				configuration.explorerHeaderActionsVisible ?? DEFAULT_EXPLORER_HEADER_ACTIONS_VISIBLE,
			explorerHidden: configuration.explorerHidden ?? false,
			mode: configuration.viewMode ?? 'preview',
			outlinePanelVisible: configuration.outlinePanelVisible ?? false,
			overlay: configuration.onboardingCompleted ? 'home' : 'onboarding',
			sidebarWidth: clampSidebarWidth(configuration.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH),
			sourcesHeaderActionsVisible:
				configuration.sourcesHeaderActionsVisible ?? DEFAULT_SOURCES_HEADER_ACTIONS_VISIBLE,
			theme: configuration.theme ?? 'dark',
			windowFrame: configuration.windowFrame,
		}),
	setBarMerged: (updater) =>
		set((state) => ({ barMerged: resolveUpdater(state.barMerged, updater) })),
	setExplorerFilters: (updater) =>
		set((state) => ({
			explorerFilters: resolveUpdater(state.explorerFilters, updater),
		})),
	setExplorerHeaderActionsVisible: (updater) =>
		set((state) => ({
			explorerHeaderActionsVisible: resolveUpdater(state.explorerHeaderActionsVisible, updater),
		})),
	setExplorerHidden: (updater) =>
		set((state) => ({ explorerHidden: resolveUpdater(state.explorerHidden, updater) })),
	setMode: (mode) => set({ mode }),
	setOutlinePanelVisible: (updater) =>
		set((state) => ({
			outlinePanelVisible: resolveUpdater(state.outlinePanelVisible, updater),
		})),
	setOverlay: (overlay) => set({ overlay }),
	setPendingFormatAction: (updater) =>
		set((state) => ({
			pendingFormatAction: resolveUpdater(state.pendingFormatAction, updater),
		})),
	setSidebarMode: (sidebarMode) => set({ sidebarMode }),
	setSidebarWidth: (width) => set({ sidebarWidth: clampSidebarWidth(width) }),
	setSourcesHeaderActionsVisible: (updater) =>
		set((state) => ({
			sourcesHeaderActionsVisible: resolveUpdater(state.sourcesHeaderActionsVisible, updater),
		})),
	setTheme: (updater) => set((state) => ({ theme: resolveUpdater(state.theme, updater) })),
	setWindowFrame: (windowFrame) => set({ windowFrame }),
	toggleExplorerFilter: (filter) =>
		set((state) => ({
			explorerFilters: {
				...state.explorerFilters,
				[filter]: !state.explorerFilters[filter],
			},
		})),
	toggleExplorerHeaderAction: (action) =>
		set((state) => ({
			explorerHeaderActionsVisible: {
				...state.explorerHeaderActionsVisible,
				[action]: !state.explorerHeaderActionsVisible[action],
			},
		})),
	toggleSourcesHeaderAction: (action) =>
		set((state) => ({
			sourcesHeaderActionsVisible: {
				...state.sourcesHeaderActionsVisible,
				[action]: !state.sourcesHeaderActionsVisible[action],
			},
		})),
}));

export const selectUiConfiguration = (state: UiStore) => ({
	explorerHidden: state.explorerHidden,
	outlinePanelVisible: state.outlinePanelVisible,
	sidebarWidth: state.sidebarWidth,
	barMerged: state.barMerged,
	viewMode: state.mode,
	theme: state.theme,
	explorerFilters: state.explorerFilters,
	explorerHeaderActionsVisible: state.explorerHeaderActionsVisible,
	sourcesHeaderActionsVisible: state.sourcesHeaderActionsVisible,
	windowFrame: state.windowFrame,
});

export const selectUiActions = (state: UiStore) => ({
	setBarMerged: state.setBarMerged,
	setExplorerHidden: state.setExplorerHidden,
	setMode: state.setMode,
	setOverlay: state.setOverlay,
	setPendingFormatAction: state.setPendingFormatAction,
	setSidebarMode: state.setSidebarMode,
	setSidebarWidth: state.setSidebarWidth,
});

export function useUiActions() {
	return useUiStore(useShallow(selectUiActions));
}
