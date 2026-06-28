import { useMemo, useRef } from 'react';
import { loadAppConfiguration, loadAppSession } from '../../../shared/state/persistence';
import { useExplorerStore } from '../../explorer/state/useExplorerStore';
import { useFileStore } from '../../files/state/useFileStore';
import { useSavedLocationsStore } from '../../saved-locations/state/useSavedLocationsStore';
import { useUiStore } from '../state/useUiStore';

export function useAppBootstrap() {
	const initialConfiguration = useMemo(() => loadAppConfiguration(), []);
	const initialSession = useMemo(() => loadAppSession(), []);
	const storesHydratedRef = useRef(false);

	if (!storesHydratedRef.current) {
		useUiStore.getState().hydrate(initialConfiguration);
		useExplorerStore.getState().hydrate(initialSession);
		useFileStore.getState().hydrate(initialSession.openFilePath);
		useSavedLocationsStore.getState().hydrate(initialConfiguration);
		storesHydratedRef.current = true;
	}

	return { initialConfiguration, initialSession };
}
