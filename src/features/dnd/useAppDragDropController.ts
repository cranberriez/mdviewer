import { useCallback, useEffect } from 'react';
import { openPath } from '@tauri-apps/plugin-opener';
import type { Entry } from '../../shared/types/files';
import { fileKindFromPath, fileName, isVisibleFileName, parentPath } from '../../shared/utils/path';
import { comparablePath } from '../../shared/utils/path';
import { recordRecentSingleFile, type RecentItem } from '../../shared/state/persistence';
import { copyPath, movePath, readFolder } from '../files/api/filesApi';
import { useUiStore } from '../app-shell/state/useUiStore';
import type { FileViewMode } from '../file-actions/components/FileActionControls';
import { useFileDrop } from './useFileDrop';
import { useInternalDrag } from './useInternalDrag';
import type { DragItem, DropMode, DropZone } from './dropTypes';

const TREE_HOVER_EXPAND_DELAY_MS = 800;

interface UseAppDragDropControllerOptions {
	activeRoot: Entry | null;
	childrenCache: Record<string, Entry[]>;
	expanded: Set<string>;
	loadingPaths: Set<string>;
	openFileAtPath: (
		path: string,
		options?: { mode?: FileViewMode; skipRecent?: boolean }
	) => Promise<void>;
	refreshFolder: (path: string) => Promise<void>;
	selectLocation: (location: Entry) => Promise<void>;
	loadFolder: (path: string, options?: { quiet?: boolean; force?: boolean }) => Promise<void>;
	onExpandedChange: (updater: (current: Set<string>) => Set<string>) => void;
	onError: (message: string | null) => void;
	onOverlayChange: (overlay: 'onboarding' | 'home' | null) => void;
	onRecentsChange: (updater: (current: RecentItem[]) => RecentItem[]) => void;
}

export function useAppDragDropController({
	activeRoot,
	childrenCache,
	expanded,
	loadingPaths,
	openFileAtPath,
	refreshFolder,
	selectLocation,
	loadFolder,
	onExpandedChange,
	onError,
	onOverlayChange,
	onRecentsChange,
}: UseAppDragDropControllerOptions) {
	const explorerFilters = useUiStore((state) => state.explorerFilters);

	const handleTreeDrop = useCallback(
		async (paths: string[], target: DropZone, dropMode: DropMode) => {
			onError(null);
			const errors: string[] = [];

			const destKey = comparablePath(target.destDir);
			for (const source of paths) {
				if (dropMode === 'move' && comparablePath(parentPath(source)) === destKey) {
					continue;
				}
				try {
					if (dropMode === 'copy') {
						await copyPath(source, target.destDir);
					} else {
						await movePath(source, target.destDir);
					}
				} catch (cause) {
					errors.push(`${fileName(source)}: ${String(cause)}`);
				}
			}

			await refreshFolder(target.destDir);
			if (dropMode === 'move') {
				const sourceParents = new Set(paths.map((path) => parentPath(path)));
				for (const parent of sourceParents) {
					if (
						parent &&
						comparablePath(parent) !== comparablePath(target.destDir) &&
						childrenCache[parent]
					) {
						await refreshFolder(parent);
					}
				}
			}

			if (errors.length > 0) {
				onError(
					errors.length === 1
						? `Couldn't ${dropMode} ${errors[0]}`
						: `Couldn't ${dropMode} ${errors.length} items:\n${errors.join('\n')}`
				);
			}
		},
		[childrenCache, onError, refreshFolder]
	);

	const handleMainOpenFile = useCallback(
		async (path: string) => {
			if (isVisibleFileName(path)) {
				onOverlayChange(null);
				await openFileAtPath(path);
			} else {
				try {
					await openPath(path);
				} catch (cause) {
					onError(`Unable to open: ${String(cause)}`);
				}
			}
		},
		[onError, onOverlayChange, openFileAtPath]
	);

	const handleMainSetRoot = useCallback(
		async (path: string) => {
			const location: Entry = { name: fileName(path) || path, path, is_dir: true, kind: 'folder' };
			await selectLocation(location);
		},
		[selectLocation]
	);

	const handleMainDrop = useCallback(
		async (firstPath: string) => {
			try {
				await readFolder(firstPath, explorerFilters);
				await handleMainSetRoot(firstPath);
			} catch {
				await handleMainOpenFile(firstPath);
			}
		},
		[explorerFilters, handleMainOpenFile, handleMainSetRoot]
	);

	const handleHomeDrop = useCallback(
		async (firstPath: string) => {
			try {
				await readFolder(firstPath, explorerFilters);
				await handleMainSetRoot(firstPath);
				return;
			} catch {
				// Not a folder; fall through to file handling.
			}

			if (!isVisibleFileName(firstPath)) {
				try {
					await openPath(firstPath);
				} catch (cause) {
					onError(`Unable to open: ${String(cause)}`);
				}
				return;
			}

			const kind = fileKindFromPath(firstPath);
			await openFileAtPath(firstPath, { mode: 'preview', skipRecent: true });
			onOverlayChange(null);
			onRecentsChange((current) =>
				recordRecentSingleFile(current, { path: firstPath, name: fileName(firstPath), kind })
			);
		},
		[explorerFilters, handleMainSetRoot, onError, onOverlayChange, onRecentsChange, openFileAtPath]
	);

	const dispatchDrop = useCallback(
		(target: DropZone | null, items: DragItem[], mode: DropMode) => {
			if (!target || items.length === 0) {
				return;
			}

			const paths = items.map((item) => item.path);

			if (target.kind === 'tree-folder' || target.kind === 'tree-root') {
				void handleTreeDrop(paths, target, mode);
				return;
			}

			const first = items[0];
			if (!first) {
				return;
			}

			if (target.kind === 'home') {
				void handleHomeDrop(first.path);
				return;
			}

			if (target.kind === 'main') {
				void handleMainDrop(first.path);
			}
		},
		[handleHomeDrop, handleMainDrop, handleTreeDrop]
	);

	const externalDrop = useFileDrop({
		activeRootPath: activeRoot?.path ?? null,
		onDrop: dispatchDrop,
	});
	const internalDrag = useInternalDrag({
		activeRootPath: activeRoot?.path ?? null,
		onDrop: dispatchDrop,
	});

	const dropState = internalDrag.state.active ? internalDrag.state : externalDrop.state;
	const dropCount = dropState.items.length;
	const treeDropTargetPath =
		dropState.target?.kind === 'tree-folder' || dropState.target?.kind === 'tree-root'
			? dropState.target.destDir
			: null;
	const rootDropActive =
		(dropState.target?.kind === 'tree-root' || dropState.target?.kind === 'tree-folder') &&
		dropState.target.destDir === activeRoot?.path;

	const hoverExpandPath =
		dropState.target?.kind === 'tree-folder' && dropState.target.destDir !== activeRoot?.path
			? dropState.target.destDir
			: null;

	useEffect(() => {
		if (!hoverExpandPath || expanded.has(hoverExpandPath) || loadingPaths.has(hoverExpandPath)) {
			return;
		}

		const timer = window.setTimeout(() => {
			onExpandedChange((current) => {
				if (current.has(hoverExpandPath)) {
					return current;
				}
				const next = new Set(current);
				next.add(hoverExpandPath);
				return next;
			});
			void loadFolder(hoverExpandPath, { quiet: true });
		}, TREE_HOVER_EXPAND_DELAY_MS);

		return () => window.clearTimeout(timer);
	}, [expanded, hoverExpandPath, loadFolder, loadingPaths, onExpandedChange]);

	return {
		beginInternalDrag: internalDrag.beginInternalDrag,
		dropCount,
		dropState,
		internalDragState: internalDrag.state,
		rootDropActive,
		treeDropTargetPath,
	};
}
