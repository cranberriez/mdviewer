import { useCallback } from 'react';
import { useUiActions } from '../state/useUiStore';
import type { Entry } from '../../../shared/types/files';
import { useOpenFileController } from '../../files/hooks/useOpenFileController';
import { useFolderTreeController } from '../../explorer/hooks/useFolderTreeController';
import { useSavedLocationsController } from '../../saved-locations/hooks/useSavedLocationsController';
import { useSavedLocationsStore } from '../../saved-locations/state/useSavedLocationsStore';
import { useExplorerActions } from '../../explorer/state/useExplorerStore';

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
	const { setMode, setOverlay } = useUiActions();
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
		async (location: Entry) => {
			setActiveRoot(location);
			setSelectedFolderPath(location.path);
			setOpenFile(null);
			setOpenFilePath(null);
			setExpanded(new Set());
			setError(null);
			setMode('preview');
			setOverlay(null);
			touchRootRecent({ path: location.path, name: location.name });
			await loadFolder(location.path);
		},
		[
			loadFolder,
			setActiveRoot,
			setError,
			setExpanded,
			setOpenFile,
			setOpenFilePath,
			setMode,
			setOverlay,
			setSelectedFolderPath,
			touchRootRecent,
		]
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
		onViewModeChange: setMode,
	});

	return {
		...openFileController,
		...folderTree,
		...savedLocations,
		selectLocation,
	};
}
