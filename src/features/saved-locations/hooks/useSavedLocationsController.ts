import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Entry } from '../../../shared/types/files';
import { recentItemKind, type RecentItem } from '../../../shared/state/persistence';
import type { FileViewMode } from '../../file-actions/components/FileActionControls';
import type { OnboardingResult } from '../../home/components/OnboardingView';
import { pickFolder } from '../../files/api/filesApi';
import { fileKindFromPath } from '../../../shared/utils/path';
import { deriveSavedLocations, isHomeLocation, isPathSavedLocation } from '../savedLocations';
import { useSavedLocationsStore } from '../state/useSavedLocationsStore';

interface UseSavedLocationsControllerOptions {
	activeRoot: Entry | null;
	defaultLocations: Entry[];
	onActiveRootChange: (root: Entry | null) => void;
	onError: (message: string) => void;
	onExpandedChange: (expanded: Set<string>) => void;
	onOpenFileAtPath: (
		path: string,
		options?: { mode?: FileViewMode; skipRecent?: boolean }
	) => Promise<void>;
	onOverlayChange: (overlay: 'onboarding' | 'home' | null) => void;
	onSelectLocation: (location: Entry) => Promise<void>;
	onViewModeChange: (mode: FileViewMode) => void;
}

export function useSavedLocationsController({
	activeRoot,
	defaultLocations,
	onActiveRootChange,
	onError,
	onExpandedChange,
	onOpenFileAtPath,
	onOverlayChange,
	onSelectLocation,
	onViewModeChange,
}: UseSavedLocationsControllerOptions) {
	const {
		locationIcons,
		onboardingCompleted,
		pinnedLocations,
		recents,
		removedDefaultPaths,
		userName,
	} = useSavedLocationsStore(
		useShallow((state) => ({
			locationIcons: state.locationIcons,
			onboardingCompleted: state.onboardingCompleted,
			pinnedLocations: state.pinnedLocations,
			recents: state.recents,
			removedDefaultPaths: state.removedDefaultPaths,
			userName: state.userName,
		}))
	);
	const homePath = defaultLocations[0]?.path;
	const locations = useMemo<Entry[]>(
		() =>
			deriveSavedLocations({
				defaultLocations,
				pinnedLocations,
				removedDefaultPaths,
				homePath,
			}),
		[defaultLocations, homePath, pinnedLocations, removedDefaultPaths]
	);
	const isPinnable = useCallback(
		(path: string) => !isPathSavedLocation(locations, path),
		[locations]
	);
	const isUnpinnable = useCallback(
		(location: Entry) => !isHomeLocation(location, homePath),
		[homePath]
	);
	const applyLocationIcon = useSavedLocationsStore((state) => state.applyLocationIcon);
	const applyOnboardingLocationChoices = useSavedLocationsStore(
		(state) => state.applyOnboardingLocationChoices
	);
	const pinFolderStore = useSavedLocationsStore((state) => state.pinFolder);
	const recordFileRecent = useSavedLocationsStore((state) => state.recordFileRecent);
	const recordSingleFileRecent = useSavedLocationsStore((state) => state.recordSingleFileRecent);
	const removeRecentItem = useSavedLocationsStore((state) => state.removeRecentItem);
	const setOnboardingCompleted = useSavedLocationsStore((state) => state.setOnboardingCompleted);
	const setRecents = useSavedLocationsStore((state) => state.setRecents);
	const setUserName = useSavedLocationsStore((state) => state.setUserName);
	const touchRootRecent = useSavedLocationsStore((state) => state.touchRootRecent);
	const unpinLocationStore = useSavedLocationsStore((state) => state.unpinLocation);
	const pinFolder = useCallback(
		(entry: Entry) => pinFolderStore(entry, defaultLocations),
		[defaultLocations, pinFolderStore]
	);
	const unpinLocation = useCallback(
		(location: Entry) => unpinLocationStore(location, defaultLocations, homePath),
		[defaultLocations, homePath, unpinLocationStore]
	);

	const toggleRootPin = useCallback(() => {
		if (!activeRoot || !isUnpinnable(activeRoot)) {
			return;
		}

		const pinned = !isPinnable(activeRoot.path);

		if (pinned) {
			const confirmed = window.confirm(`Remove "${activeRoot.name}" from your pinned folders?`);
			if (confirmed) {
				unpinLocation(activeRoot);
			}
			return;
		}

		const confirmed = window.confirm(`Pin "${activeRoot.name}" to your saved folders?`);
		if (confirmed) {
			pinFolder(activeRoot);
		}
	}, [activeRoot, isPinnable, isUnpinnable, pinFolder, unpinLocation]);

	const openRecent = useCallback(
		async (item: RecentItem) => {
			if (recentItemKind(item) === 'file') {
				onActiveRootChange(null);
				onExpandedChange(new Set());
				onOverlayChange(null);
				await onOpenFileAtPath(item.path, { mode: 'preview', skipRecent: true });
				const kind = fileKindFromPath(item.path);
				recordSingleFileRecent({ path: item.path, name: item.name, kind });
				return;
			}

			const location: Entry = { name: item.name, path: item.path, is_dir: true, kind: 'folder' };
			await onSelectLocation(location);

			if (item.lastFile) {
				await onOpenFileAtPath(item.lastFile.path);
			}
		},
		[onActiveRootChange, onExpandedChange, onOpenFileAtPath, onOverlayChange, onSelectLocation]
	);

	const completeOnboarding = useCallback(
		(result: OnboardingResult) => {
			setUserName(result.name);
			onViewModeChange(result.viewMode);

			applyOnboardingLocationChoices(defaultLocations, homePath, result.starterFolders);

			setOnboardingCompleted(true);
			onOverlayChange('home');
		},
		[
			defaultLocations,
			homePath,
			applyOnboardingLocationChoices,
			onOverlayChange,
			onViewModeChange,
			setOnboardingCompleted,
			setUserName,
		]
	);

	const skipOnboarding = useCallback(() => {
		setOnboardingCompleted(true);
		onOverlayChange('home');
	}, [onOverlayChange]);

	const openFolderAsRoot = useCallback(async () => {
		try {
			const folder = await pickFolder();
			if (!folder) {
				return;
			}
			await onSelectLocation(folder);
		} catch (cause) {
			onError(`Unable to open folder: ${String(cause)}`);
		}
	}, [onError, onSelectLocation]);

	return {
		homePath,
		isPinnable,
		isUnpinnable,
		locationIcons,
		locations,
		onboardingCompleted,
		recents,
		userName,
		setRecents,
		applyLocationIcon,
		completeOnboarding,
		openFolderAsRoot,
		openRecent,
		pinFolder,
		recordFileRecent,
		removeRecentItem,
		skipOnboarding,
		touchRootRecent,
		toggleRootPin,
		unpinLocation,
	};
}
