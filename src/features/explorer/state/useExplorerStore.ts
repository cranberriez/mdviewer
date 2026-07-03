import { create } from 'zustand';
import type { Entry } from '../../../shared/types/files';
import type { AppSessionState } from '../../../shared/state/persistence';
import { parentPath } from '../../../shared/utils/path';

type SetUpdater<T> = T | ((current: T) => T);

function resolveUpdater<T>(current: T, updater: SetUpdater<T>) {
	return typeof updater === 'function' ? (updater as (current: T) => T)(current) : updater;
}

interface ExplorerState {
	activeRoot: Entry | null;
	childrenCache: Record<string, Entry[]>;
	defaultLocs: Entry[];
	error: string | null;
	expanded: Set<string>;
	focusedEntry: Entry | null;
	loadingPaths: Set<string>;
	selectedFolderPath: string | null;
	sessionHydrated: boolean;
}

interface ExplorerActions {
	hydrate: (session: AppSessionState) => void;
	setActiveRoot: (activeRoot: Entry | null) => void;
	setChildrenCache: (updater: SetUpdater<Record<string, Entry[]>>) => void;
	setDefaultLocs: (defaultLocs: Entry[]) => void;
	setError: (error: string | null) => void;
	setExpanded: (updater: SetUpdater<Set<string>>) => void;
	setFocusedEntry: (updater: SetUpdater<Entry | null>) => void;
	setLoadingPaths: (updater: SetUpdater<Set<string>>) => void;
	setSelectedFolderPath: (updater: SetUpdater<string | null>) => void;
	setSessionHydrated: (sessionHydrated: boolean) => void;
}

export type ExplorerStore = ExplorerState & ExplorerActions;

export const useExplorerStore = create<ExplorerStore>()((set) => ({
	activeRoot: null,
	childrenCache: {},
	defaultLocs: [],
	error: null,
	expanded: new Set(),
	focusedEntry: null,
	loadingPaths: new Set(),
	selectedFolderPath: null,
	sessionHydrated: false,

	hydrate: (session) =>
		set({
			activeRoot: null,
			childrenCache: {},
			defaultLocs: [],
			error: null,
			expanded: new Set(session.expandedPaths),
			focusedEntry: null,
			loadingPaths: new Set(),
			selectedFolderPath:
				session.selectedFolderPath ??
				(session.openFilePath ? parentPath(session.openFilePath) : null),
			sessionHydrated: false,
		}),
	setActiveRoot: (activeRoot) => set({ activeRoot }),
	setChildrenCache: (updater) =>
		set((state) => ({ childrenCache: resolveUpdater(state.childrenCache, updater) })),
	setDefaultLocs: (defaultLocs) => set({ defaultLocs }),
	setError: (error) => set({ error }),
	setExpanded: (updater) => set((state) => ({ expanded: resolveUpdater(state.expanded, updater) })),
	setFocusedEntry: (updater) =>
		set((state) => ({ focusedEntry: resolveUpdater(state.focusedEntry, updater) })),
	setLoadingPaths: (updater) =>
		set((state) => ({ loadingPaths: resolveUpdater(state.loadingPaths, updater) })),
	setSelectedFolderPath: (updater) =>
		set((state) => ({
			selectedFolderPath: resolveUpdater(state.selectedFolderPath, updater),
		})),
	setSessionHydrated: (sessionHydrated) => set({ sessionHydrated }),
}));

export const selectExplorerTree = (state: ExplorerStore) => ({
	activeRoot: state.activeRoot,
	childrenCache: state.childrenCache,
	defaultLocs: state.defaultLocs,
	error: state.error,
	expanded: state.expanded,
	focusedEntry: state.focusedEntry,
	loadingPaths: state.loadingPaths,
	selectedFolderPath: state.selectedFolderPath,
	sessionHydrated: state.sessionHydrated,
});
