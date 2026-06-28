import { useEffect, type RefObject } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
	saveAppConfiguration,
	saveAppSession,
	type AppConfigurationState,
	type AppTheme,
	type StoredWindowFrame,
} from '../../../shared/state/persistence';
import { useThemeClass } from '../../../shared/hooks/useThemeClass';
import { useWindowFramePersistence } from '../../window-chrome/hooks/useWindowFramePersistence';
import type { UnsavedFileDrafts } from '../../files/hooks/useOpenFileController';
import { useExplorerStore } from '../../explorer/state/useExplorerStore';
import { useFileStore } from '../../files/state/useFileStore';
import {
	selectSavedConfiguration,
	useSavedLocationsStore,
} from '../../saved-locations/state/useSavedLocationsStore';
import { selectUiConfiguration, useUiStore } from '../state/useUiStore';

interface UseAppPersistenceOptions {
	configurationRef: RefObject<AppConfigurationState>;
	initialFrame?: StoredWindowFrame;
	theme: AppTheme;
	unsavedFileDraftsRef: RefObject<UnsavedFileDrafts>;
}

export function useAppPersistence({
	configurationRef,
	initialFrame,
	theme,
	unsavedFileDraftsRef,
}: UseAppPersistenceOptions) {
	const activeRootPath = useExplorerStore((state) => state.activeRoot?.path);
	const expanded = useExplorerStore((state) => state.expanded);
	const openFilePath = useFileStore((state) => state.openFilePath);
	const selectedFolderPath = useExplorerStore((state) => state.selectedFolderPath);
	const sessionHydrated = useExplorerStore((state) => state.sessionHydrated);
	const setWindowFrame = useUiStore((state) => state.setWindowFrame);
	const uiConfiguration = useUiStore(useShallow(selectUiConfiguration));
	const savedConfiguration = useSavedLocationsStore(useShallow(selectSavedConfiguration));

	const { isMaximized } = useWindowFramePersistence({
		initialFrame,
		configurationRef,
		unsavedFileDraftsRef,
		onFrameChange: setWindowFrame,
	});

	useThemeClass(theme);

	useEffect(() => {
		const nextConfiguration: AppConfigurationState = {
			...uiConfiguration,
			...savedConfiguration,
		};

		configurationRef.current = nextConfiguration;
		saveAppConfiguration(nextConfiguration);
	}, [configurationRef, savedConfiguration, uiConfiguration]);

	useEffect(() => {
		if (!sessionHydrated) {
			return;
		}

		saveAppSession({
			activeRootPath,
			selectedFolderPath: selectedFolderPath ?? undefined,
			openFilePath: openFilePath ?? undefined,
			expandedPaths: Array.from(expanded),
		});
	}, [activeRootPath, expanded, openFilePath, selectedFolderPath, sessionHydrated]);

	return { isMaximized };
}
