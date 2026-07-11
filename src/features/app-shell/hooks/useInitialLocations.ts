import { useEffect } from 'react';
import { defaultLocations } from '../../files/api/filesApi';
import type { AppConfigurationState, AppSessionState } from '../../../shared/state/persistence';
import { fileName, parentPath } from '../../../shared/utils/path';
import { findContainingLocation } from '../../saved-locations/savedLocations';
import { useExplorerStore } from '../../explorer/state/useExplorerStore';

interface UseInitialLocationsOptions {
	initialConfiguration: Partial<AppConfigurationState>;
	initialSession: AppSessionState;
	loadFolder: (path: string, options?: { quiet?: boolean; force?: boolean }) => Promise<void>;
	openFileAtPath: (path: string, options?: { skipRecent?: boolean }) => Promise<void>;
}

export function useInitialLocations({
	initialConfiguration,
	initialSession,
	loadFolder,
	openFileAtPath,
}: UseInitialLocationsOptions) {
	const setActiveRoot = useExplorerStore((state) => state.setActiveRoot);
	const setDefaultLocs = useExplorerStore((state) => state.setDefaultLocs);
	const setError = useExplorerStore((state) => state.setError);
	const setSelectedFolderPath = useExplorerStore((state) => state.setSelectedFolderPath);
	const setSessionHydrated = useExplorerStore((state) => state.setSessionHydrated);

	useEffect(() => {
		let cancelled = false;

		async function loadLocations() {
			try {
				const systemDefaults = await defaultLocations();
				if (cancelled) {
					return;
				}
				const defaults = initialConfiguration.homeLocation
					? [initialConfiguration.homeLocation, ...systemDefaults.slice(1)]
					: systemDefaults;

				setDefaultLocs(defaults);
				const restorable = [...defaults, ...(initialConfiguration.pinnedLocations ?? [])];
				const restoredRoot =
					restorable.find((location) => location.path === initialSession.activeRootPath) ??
					restorable.find((location) => location.path === initialSession.selectedFolderPath) ??
					findContainingLocation(restorable, initialSession.openFilePath) ??
					findContainingLocation(restorable, initialSession.selectedFolderPath) ??
					(initialSession.activeRootPath
						? {
								name: fileName(initialSession.activeRootPath),
								path: initialSession.activeRootPath,
								is_dir: true,
								kind: 'folder' as const,
							}
						: null);
				const first = restoredRoot ?? defaults[0] ?? null;
				const restoredSelectedFolder =
					initialSession.selectedFolderPath ??
					(initialSession.openFilePath
						? parentPath(initialSession.openFilePath)
						: (first?.path ?? null));

				setActiveRoot(first);
				setSelectedFolderPath(restoredSelectedFolder);

				if (first) {
					await loadFolder(first.path);
					await Promise.all(
						initialSession.expandedPaths
							.filter((path) => path !== first.path)
							.map((path) => loadFolder(path, { quiet: true }))
					);
				}

				if (initialSession.openFilePath) {
					await openFileAtPath(initialSession.openFilePath, { skipRecent: true });
				}
			} catch (cause) {
				if (!cancelled) {
					setError(`Unable to load default locations: ${String(cause)}`);
				}
			} finally {
				if (!cancelled) {
					setSessionHydrated(true);
				}
			}
		}

		void loadLocations();

		return () => {
			cancelled = true;
		};
	}, [
		initialConfiguration,
		initialSession,
		setActiveRoot,
		setDefaultLocs,
		setError,
		setSelectedFolderPath,
		setSessionHydrated,
	]);
}
