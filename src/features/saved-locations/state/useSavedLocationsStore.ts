import { create } from 'zustand';
import type { Entry } from '../../../shared/types/files';
import {
	recordRecentFile,
	recordRecentSingleFile,
	recentItemKind,
	removeRecent,
	touchRecentRoot,
	type AppConfigurationState,
	type RecentItem,
} from '../../../shared/state/persistence';
import { comparablePath } from '../../../shared/utils/path';
import { deriveSavedLocations, isHomeLocation, isPathSavedLocation } from '../savedLocations';

type RecentsUpdater = RecentItem[] | ((current: RecentItem[]) => RecentItem[]);

function resolveRecentsUpdater(current: RecentItem[], updater: RecentsUpdater) {
	return typeof updater === 'function'
		? (updater as (current: RecentItem[]) => RecentItem[])(current)
		: updater;
}

interface SavedLocationsState {
	locationIcons: Record<string, string>;
	onboardingCompleted: boolean;
	pinnedLocations: Entry[];
	recents: RecentItem[];
	removedDefaultPaths: string[];
	userName: string;
}

interface SavedLocationsActions {
	hydrate: (configuration: Partial<AppConfigurationState>) => void;
	setOnboardingCompleted: (onboardingCompleted: boolean) => void;
	setRecents: (updater: RecentsUpdater) => void;
	setUserName: (userName: string) => void;
	applyLocationIcon: (location: Entry, iconName: string) => void;
	applyOnboardingLocationChoices: (
		defaultLocations: Entry[],
		homePath: string | undefined,
		keptFolders: Entry[]
	) => void;
	pinFolder: (entry: Entry, defaultLocations: Entry[]) => void;
	recordFileRecent: (
		root: { path: string; name: string },
		file: { path: string; name: string; kind: 'md' | 'text' }
	) => void;
	recordSingleFileRecent: (file: { path: string; name: string; kind: 'md' | 'text' }) => void;
	removeRecentItem: (item: RecentItem) => void;
	touchRootRecent: (root: { path: string; name: string }) => void;
	unpinLocation: (location: Entry, defaultLocations: Entry[], homePath?: string) => void;
}

export type SavedLocationsStore = SavedLocationsState & SavedLocationsActions;

function getLocations(state: SavedLocationsState, defaultLocations: Entry[], homePath?: string) {
	return deriveSavedLocations({
		defaultLocations,
		pinnedLocations: state.pinnedLocations,
		removedDefaultPaths: state.removedDefaultPaths,
		homePath,
	});
}

function pinFolderInState(
	state: SavedLocationsState,
	entry: Entry,
	defaultLocations: Entry[]
): Partial<SavedLocationsState> {
	const key = comparablePath(entry.path);
	const isDefault = defaultLocations.some((location) => comparablePath(location.path) === key);

	if (isDefault) {
		return {
			removedDefaultPaths: state.removedDefaultPaths.filter((path) => comparablePath(path) !== key),
		};
	}

	if (state.pinnedLocations.some((location) => comparablePath(location.path) === key)) {
		return {};
	}

	return {
		pinnedLocations: [...state.pinnedLocations, { ...entry, is_dir: true, kind: 'folder' }],
	};
}

function unpinLocationInState(
	state: SavedLocationsState,
	location: Entry,
	defaultLocations: Entry[],
	homePath?: string
): Partial<SavedLocationsState> {
	if (isHomeLocation(location, homePath)) {
		return {};
	}

	const key = comparablePath(location.path);
	const isDefault = defaultLocations.some((entry) => comparablePath(entry.path) === key);

	if (isDefault) {
		return state.removedDefaultPaths.some((path) => comparablePath(path) === key)
			? {}
			: { removedDefaultPaths: [...state.removedDefaultPaths, location.path] };
	}

	return {
		pinnedLocations: state.pinnedLocations.filter((entry) => comparablePath(entry.path) !== key),
	};
}

export const useSavedLocationsStore = create<SavedLocationsStore>()((set) => ({
	locationIcons: {},
	onboardingCompleted: false,
	pinnedLocations: [],
	recents: [],
	removedDefaultPaths: [],
	userName: '',

	hydrate: (configuration) =>
		set({
			locationIcons: configuration.locationIcons ?? {},
			onboardingCompleted: configuration.onboardingCompleted ?? false,
			pinnedLocations: configuration.pinnedLocations ?? [],
			recents: configuration.recents ?? [],
			removedDefaultPaths: configuration.removedDefaultPaths ?? [],
			userName: configuration.userName ?? '',
		}),
	setOnboardingCompleted: (onboardingCompleted) => set({ onboardingCompleted }),
	setRecents: (updater) =>
		set((state) => ({ recents: resolveRecentsUpdater(state.recents, updater) })),
	setUserName: (userName) => set({ userName }),
	applyLocationIcon: (location, iconName) =>
		set((state) => ({
			locationIcons: { ...state.locationIcons, [location.path]: iconName },
		})),
	applyOnboardingLocationChoices: (defaultLocations, homePath, keptFolders) =>
		set((state) => {
			let next: SavedLocationsState = state;

			for (const folder of keptFolders) {
				if (!isPathSavedLocation(getLocations(next, defaultLocations, homePath), folder.path)) {
					next = { ...next, ...pinFolderInState(next, folder, defaultLocations) };
				}
			}

			const keptPaths = new Set(keptFolders.map((folder) => comparablePath(folder.path)));
			for (const location of defaultLocations) {
				const isHome = homePath
					? comparablePath(homePath) === comparablePath(location.path)
					: false;
				if (!isHome && !keptPaths.has(comparablePath(location.path))) {
					next = {
						...next,
						...unpinLocationInState(next, location, defaultLocations, homePath),
					};
				}
			}

			return next;
		}),
	pinFolder: (entry, defaultLocations) =>
		set((state) => pinFolderInState(state, entry, defaultLocations)),
	recordFileRecent: (root, file) =>
		set((state) => ({ recents: recordRecentFile(state.recents, root, file) })),
	recordSingleFileRecent: (file) =>
		set((state) => ({
			recents: recordRecentSingleFile(state.recents, file),
		})),
	removeRecentItem: (item) =>
		set((state) => ({
			recents: removeRecent(state.recents, { path: item.path, kind: recentItemKind(item) }),
		})),
	touchRootRecent: (root) => set((state) => ({ recents: touchRecentRoot(state.recents, root) })),
	unpinLocation: (location, defaultLocations, homePath) =>
		set((state) => unpinLocationInState(state, location, defaultLocations, homePath)),
}));

export const selectSavedConfiguration = (state: SavedLocationsStore) => ({
	pinnedLocations: state.pinnedLocations,
	removedDefaultPaths: state.removedDefaultPaths,
	locationIcons: state.locationIcons,
	onboardingCompleted: state.onboardingCompleted,
	userName: state.userName,
	recents: state.recents,
});
