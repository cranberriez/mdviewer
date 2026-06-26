import { useCallback, useMemo, useState } from 'react';
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
import type { FileViewMode } from '../../file-actions/components/FileActionControls';
import type { OnboardingResult } from '../../home/components/OnboardingView';
import { pickFolder } from '../../files/api/filesApi';
import { comparablePath, fileKindFromPath } from '../../../shared/utils/path';
import { deriveSavedLocations, isHomeLocation, isPathSavedLocation } from '../savedLocations';

interface UseSavedLocationsControllerOptions {
	activeRoot: Entry | null;
	defaultLocations: Entry[];
	initialConfiguration: Partial<AppConfigurationState>;
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
	initialConfiguration,
	onActiveRootChange,
	onError,
	onExpandedChange,
	onOpenFileAtPath,
	onOverlayChange,
	onSelectLocation,
	onViewModeChange,
}: UseSavedLocationsControllerOptions) {
	const [pinnedLocations, setPinnedLocations] = useState<Entry[]>(
		() => initialConfiguration.pinnedLocations ?? []
	);
	const [removedDefaultPaths, setRemovedDefaultPaths] = useState<string[]>(
		() => initialConfiguration.removedDefaultPaths ?? []
	);
	const [locationIcons, setLocationIcons] = useState<Record<string, string>>(
		() => initialConfiguration.locationIcons ?? {}
	);
	const [recents, setRecents] = useState<RecentItem[]>(() => initialConfiguration.recents ?? []);
	const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(
		() => initialConfiguration.onboardingCompleted ?? false
	);
	const [userName, setUserName] = useState<string>(() => initialConfiguration.userName ?? '');

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

	const recordFileRecent = useCallback(
		(
			root: { path: string; name: string },
			file: { path: string; name: string; kind: 'md' | 'text' }
		) => {
			setRecents((current) => recordRecentFile(current, root, file));
		},
		[]
	);

	const touchRootRecent = useCallback((root: { path: string; name: string }) => {
		setRecents((current) => touchRecentRoot(current, root));
	}, []);

	const pinFolder = useCallback(
		(entry: Entry) => {
			const key = comparablePath(entry.path);
			const isDefault = defaultLocations.some((location) => comparablePath(location.path) === key);

			if (isDefault) {
				setRemovedDefaultPaths((current) => current.filter((path) => comparablePath(path) !== key));
				return;
			}

			setPinnedLocations((current) =>
				current.some((location) => comparablePath(location.path) === key)
					? current
					: [...current, { ...entry, is_dir: true, kind: 'folder' }]
			);
		},
		[defaultLocations]
	);

	const unpinLocation = useCallback(
		(location: Entry) => {
			if (!isUnpinnable(location)) {
				return;
			}

			const key = comparablePath(location.path);
			const isDefault = defaultLocations.some((entry) => comparablePath(entry.path) === key);

			if (isDefault) {
				setRemovedDefaultPaths((current) =>
					current.some((path) => comparablePath(path) === key)
						? current
						: [...current, location.path]
				);
			} else {
				setPinnedLocations((current) =>
					current.filter((entry) => comparablePath(entry.path) !== key)
				);
			}
		},
		[defaultLocations, isUnpinnable]
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
				setRecents((current) =>
					recordRecentSingleFile(current, { path: item.path, name: item.name, kind })
				);
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

	const removeRecentItem = useCallback((item: RecentItem) => {
		setRecents((current) => removeRecent(current, { path: item.path, kind: recentItemKind(item) }));
	}, []);

	const completeOnboarding = useCallback(
		(result: OnboardingResult) => {
			setUserName(result.name);
			onViewModeChange(result.viewMode);

			result.starterFolders.forEach((folder) => {
				if (isPinnable(folder.path)) {
					pinFolder(folder);
				}
			});

			const keptPaths = new Set(result.starterFolders.map((folder) => comparablePath(folder.path)));
			defaultLocations.forEach((location) => {
				const isHome = homePath
					? comparablePath(homePath) === comparablePath(location.path)
					: false;
				if (!isHome && !keptPaths.has(comparablePath(location.path))) {
					unpinLocation(location);
				}
			});

			setOnboardingCompleted(true);
			onOverlayChange('home');
		},
		[
			defaultLocations,
			homePath,
			isPinnable,
			onOverlayChange,
			onViewModeChange,
			pinFolder,
			unpinLocation,
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

	const applyLocationIcon = useCallback((location: Entry, iconName: string) => {
		setLocationIcons((current) => ({ ...current, [location.path]: iconName }));
	}, []);

	return {
		homePath,
		isPinnable,
		isUnpinnable,
		locationIcons,
		locations,
		onboardingCompleted,
		pinnedLocations,
		recents,
		removedDefaultPaths,
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
