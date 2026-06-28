import { useCallback } from 'react';
import type { Entry } from '../../../shared/types/files';
import { parentPath } from '../../../shared/utils/path';
import type { FileViewMode } from '../../file-actions/components/FileActionControls';
import { readFolder } from '../../files/api/filesApi';
import { useFileStore } from '../../files/state/useFileStore';
import { useUiStore } from '../../app-shell/state/useUiStore';
import { useExplorerStore } from '../state/useExplorerStore';

interface UseFolderTreeControllerOptions {
	openFileAtPath: (
		path: string,
		options?: { mode?: FileViewMode; skipRecent?: boolean }
	) => Promise<void>;
}

export function useFolderTreeController({ openFileAtPath }: UseFolderTreeControllerOptions) {
	const activeRoot = useExplorerStore((state) => state.activeRoot);
	const childrenCache = useExplorerStore((state) => state.childrenCache);
	const expanded = useExplorerStore((state) => state.expanded);
	const openFilePath = useFileStore((state) => state.openFilePath);
	const selectedFolderPath = useExplorerStore((state) => state.selectedFolderPath);
	const setChildrenCache = useExplorerStore((state) => state.setChildrenCache);
	const setError = useExplorerStore((state) => state.setError);
	const setExpanded = useExplorerStore((state) => state.setExpanded);
	const setFocusedEntry = useExplorerStore((state) => state.setFocusedEntry);
	const setLoadingPaths = useExplorerStore((state) => state.setLoadingPaths);
	const setOverlay = useUiStore((state) => state.setOverlay);
	const setSelectedFolderPath = useExplorerStore((state) => state.setSelectedFolderPath);

	const getCreateTargetFolder = useCallback(
		() =>
			selectedFolderPath ??
			(openFilePath ? parentPath(openFilePath) : null) ??
			activeRoot?.path ??
			null,
		[activeRoot?.path, openFilePath, selectedFolderPath]
	);

	const loadFolder = useCallback(
		async (path: string, options?: { quiet?: boolean; force?: boolean }) => {
			if (childrenCache[path] && !options?.force) {
				return;
			}

			if (!options?.quiet) {
				setError(null);
			}
			setLoadingPaths((current) => new Set(current).add(path));

			try {
				const children = await readFolder(path);
				setChildrenCache((current) => ({ ...current, [path]: children }));
			} catch (cause) {
				if (!options?.quiet) {
					setError(`Unable to read folder: ${String(cause)}`);
				}
			} finally {
				setLoadingPaths((current) => {
					const next = new Set(current);
					next.delete(path);
					return next;
				});
			}
		},
		[childrenCache, setChildrenCache, setError, setLoadingPaths]
	);

	const refreshFolder = useCallback(
		async (path: string) => {
			await loadFolder(path, { force: true, quiet: true });
		},
		[loadFolder]
	);

	const toggleFolder = useCallback(
		async (entry: Entry) => {
			const willExpand = !expanded.has(entry.path);
			setSelectedFolderPath(entry.path);
			setFocusedEntry(entry);

			setExpanded((current) => {
				const next = new Set(current);
				if (willExpand) {
					next.add(entry.path);
				} else {
					next.delete(entry.path);
				}
				return next;
			});

			if (willExpand) {
				await loadFolder(entry.path);
			}
		},
		[expanded, loadFolder, setExpanded, setFocusedEntry, setSelectedFolderPath]
	);

	const selectFile = useCallback(
		async (entry: Entry) => {
			setFocusedEntry(entry);
			setOverlay(null);
			await openFileAtPath(entry.path);
		},
		[openFileAtPath, setFocusedEntry, setOverlay]
	);

	return {
		getCreateTargetFolder,
		loadFolder,
		refreshFolder,
		selectFile,
		toggleFolder,
	};
}
