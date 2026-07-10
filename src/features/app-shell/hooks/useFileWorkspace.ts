import { useCallback } from 'react';
import { useUiActions } from '../state/useUiStore';
import type { Entry } from '../../../shared/types/files';
import { useOpenFileController } from '../../files/hooks/useOpenFileController';
import { useFolderTreeController } from '../../explorer/hooks/useFolderTreeController';
import { useSavedLocationsController } from '../../saved-locations/hooks/useSavedLocationsController';
import { useSavedLocationsStore } from '../../saved-locations/state/useSavedLocationsStore';
import { useExplorerActions, useExplorerStore } from '../../explorer/state/useExplorerStore';
import {
	recentItemKind,
	type ShellIntegrationPreferences,
} from '../../../shared/state/persistence';
import {
	comparablePath,
	containsPath,
	fileKindFromPath,
	fileName,
	parentPath,
} from '../../../shared/utils/path';
import { configureShellIntegration, entryForPath, folderEntry } from '../../files/api/filesApi';

interface UseFileWorkspaceOptions {
	activeRoot: Entry | null;
	defaultLocations: Entry[];
	initialOpenFilePath?: string | null;
}

export function useFileWorkspace({
	activeRoot,
	defaultLocations,
	initialOpenFilePath,
}: UseFileWorkspaceOptions) {
	const { setActiveRoot, setError, setExpanded, setSelectedFolderPath } = useExplorerActions();
	const { setMode, setOverlay, setShellIntegration } = useUiActions();
	const recordFileRecent = useSavedLocationsStore((state) => state.recordFileRecent);
	const touchRootRecent = useSavedLocationsStore((state) => state.touchRootRecent);

	const openFileController = useOpenFileController({
		activeRoot,
		initialOpenFilePath,
		onError: setError,
		onRecordFileRecent: recordFileRecent,
		onSelectedFolderPathChange: setSelectedFolderPath,
		onViewModeChange: setMode,
	});

	const folderTree = useFolderTreeController({
		openFileAtPath: openFileController.openFileAtPath,
	});
	const { loadFolder } = folderTree;
	const { openFileAtPath, setOpenFile, setOpenFilePath } = openFileController;

	const selectLocation = useCallback(
		async (location: Entry, options?: { restoreLastFile?: boolean }) => {
			const recent = useSavedLocationsStore
				.getState()
				.recents.find(
					(item) =>
						recentItemKind(item) === 'root' &&
						comparablePath(item.path) === comparablePath(location.path)
				);
			setActiveRoot(location);
			setSelectedFolderPath(location.path);
			setOpenFile(null);
			setOpenFilePath(null);
			setExpanded(new Set());
			setError(null);
			setOverlay(null);
			touchRootRecent({ path: location.path, name: location.name });
			await loadFolder(location.path);
			if (options?.restoreLastFile !== false && recent?.lastFile) {
				await openFileAtPath(recent.lastFile.path, { skipRecent: true });
			}
		},
		[
			loadFolder,
			openFileAtPath,
			setActiveRoot,
			setError,
			setExpanded,
			setOpenFile,
			setOpenFilePath,
			setOverlay,
			setSelectedFolderPath,
			touchRootRecent,
		]
	);

	const updateShellIntegration = useCallback(
		async (preferences: ShellIntegrationPreferences) => {
			await configureShellIntegration(preferences);
			setShellIntegration(preferences);
		},
		[setShellIntegration]
	);

	const savedLocations = useSavedLocationsController({
		activeRoot,
		defaultLocations,
		onActiveRootChange: setActiveRoot,
		onError: setError,
		onExpandedChange: setExpanded,
		onOpenFileAtPath: openFileAtPath,
		onOverlayChange: setOverlay,
		onSelectLocation: selectLocation,
		onShellIntegrationChange: updateShellIntegration,
		onViewModeChange: setMode,
	});

	const openExternalPath = useCallback(
		async (path: string, options?: { restoreLastFileForFolder?: boolean }) => {
			const entry = await entryForPath(path);
			if (entry.is_dir) {
				await selectLocation(entry, {
					restoreLastFile: options?.restoreLastFileForFolder ?? true,
				});
				return;
			}

			const currentRoot = useExplorerStore.getState().activeRoot;
			const root =
				currentRoot && containsPath(currentRoot.path, path)
					? currentRoot
					: await folderEntry(parentPath(path));

			if (!currentRoot || comparablePath(currentRoot.path) !== comparablePath(root.path)) {
				await selectLocation(root, { restoreLastFile: false });
			}

			await openFileAtPath(path, { skipRecent: true });
			recordFileRecent(
				{ path: root.path, name: root.name },
				{ path, name: fileName(path), kind: fileKindFromPath(path) }
			);
			setOverlay(null);
		},
		[openFileAtPath, recordFileRecent, selectLocation, setOverlay]
	);

	return {
		...openFileController,
		...folderTree,
		...savedLocations,
		openExternalPath,
		selectLocation,
	};
}
