import { useEffect, useRef } from 'react';
import { useUiStore } from '../../app-shell/state/useUiStore';
import { useExplorerStore } from '../state/useExplorerStore';

interface UseExplorerFilterMenuControllerOptions {
	loadFolder: (path: string, options?: { quiet?: boolean; force?: boolean }) => Promise<void>;
}

export function useExplorerFilterMenuController({
	loadFolder,
}: UseExplorerFilterMenuControllerOptions) {
	const activeRoot = useExplorerStore((state) => state.activeRoot);
	const expanded = useExplorerStore((state) => state.expanded);
	const setChildrenCache = useExplorerStore((state) => state.setChildrenCache);
	const explorerFilters = useUiStore((state) => state.explorerFilters);
	const previousFilterKeyRef = useRef<string | null>(null);

	useEffect(() => {
		const filterKey = `${explorerFilters.showHiddenItems}:${explorerFilters.showNonTextFiles}`;
		if (previousFilterKeyRef.current === null) {
			previousFilterKeyRef.current = filterKey;
			return;
		}
		if (previousFilterKeyRef.current === filterKey) {
			return;
		}

		previousFilterKeyRef.current = filterKey;
		if (!activeRoot) {
			return;
		}

		const pathsToReload = new Set([activeRoot.path, ...expanded]);
		setChildrenCache({});
		pathsToReload.forEach((path) => {
			void loadFolder(path, { force: true, quiet: true });
		});
	}, [activeRoot, expanded, explorerFilters, loadFolder, setChildrenCache]);

	return { explorerFilters };
}
