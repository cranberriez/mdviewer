import { useCallback } from 'react';
import { deletePath, revealInExplorer } from '../../files/api/filesApi';
import type { Entry } from '../../../shared/types/files';
import type { UnsavedFileDrafts } from '../../files/hooks/useOpenFileController';
import type { ContextMenuAction, ContextMenuTarget } from '../components/ContextMenu';
import { useFileStore } from '../../files/state/useFileStore';
import { useMenuStore } from '../../app-shell/state/useMenuStore';
import { useSavedLocationsStore } from '../../saved-locations/state/useSavedLocationsStore';
import { useExplorerStore } from '../state/useExplorerStore';
import {
	fileKindFromPath,
	isVisibleFileName,
	parentPath,
	relativePath,
} from '../../../shared/utils/path';
import { confirmDeleteTarget, pathIsDeletedTarget } from '../utils/contextTargets';
import type { FileViewMode } from '../../file-actions/components/FileActionControls';

interface UseExplorerContextActionsOptions {
	locations: Entry[];
	loadFolder: (path: string, options?: { quiet?: boolean; force?: boolean }) => Promise<void>;
	openFileAtPath: (
		path: string,
		options?: { mode?: FileViewMode; skipRecent?: boolean }
	) => Promise<void>;
	pinFolder: (entry: Entry) => void;
	refreshFolder: (path: string) => Promise<void>;
	selectLocation: (location: Entry) => Promise<void>;
	startCreateDraft: (parentPath: string, kind: 'file' | 'folder') => Promise<void>;
	startRenameDraft: (entry: Entry) => void;
}

export function useExplorerContextActions({
	locations,
	loadFolder,
	openFileAtPath,
	pinFolder,
	refreshFolder,
	selectLocation,
	startCreateDraft,
	startRenameDraft,
}: UseExplorerContextActionsOptions) {
	const activeRoot = useExplorerStore((state) => state.activeRoot);
	const contextMenuRecent = useMenuStore((state) => state.contextMenuRecent);
	const closeContextMenu = useMenuStore((state) => state.closeContextMenu);
	const openFilePath = useFileStore((state) => state.openFilePath);
	const setActiveRoot = useExplorerStore((state) => state.setActiveRoot);
	const setChildrenCache = useExplorerStore((state) => state.setChildrenCache);
	const setError = useExplorerStore((state) => state.setError);
	const setExpanded = useExplorerStore((state) => state.setExpanded);
	const setFocusedEntry = useExplorerStore((state) => state.setFocusedEntry);
	const setOpenFile = useFileStore((state) => state.setOpenFile);
	const setOpenFilePath = useFileStore((state) => state.setOpenFilePath);
	const setRecents = useSavedLocationsStore((state) => state.setRecents);
	const setSelectedFolderPath = useExplorerStore((state) => state.setSelectedFolderPath);
	const updateUnsavedFileDrafts = useFileStore((state) => state.updateUnsavedFileDrafts);
	const removeRecentItem = useSavedLocationsStore((state) => state.removeRecentItem);

	return useCallback(
		async (action: ContextMenuAction, target: ContextMenuTarget) => {
			const recentForAction = contextMenuRecent;
			closeContextMenu();

			try {
				switch (action) {
					case 'remove-recent':
						if (recentForAction) {
							removeRecentItem(recentForAction);
						}
						break;
					case 'open':
						if (target.kind === 'file') {
							if (!isVisibleFileName(target.path)) {
								setError(`Unsupported file type: ${target.name}`);
								break;
							}
							await openFileAtPath(target.path);
						}
						break;
					case 'new-file':
						await startCreateDraft(target.path, 'file');
						break;
					case 'new-folder':
						await startCreateDraft(target.path, 'folder');
						break;
					case 'pin':
						pinFolder({
							name: target.name,
							path: target.path,
							is_dir: true,
							kind: 'folder',
						});
						break;
					case 'open-as-root':
						if (target.kind === 'folder') {
							await selectLocation({
								name: target.name,
								path: target.path,
								is_dir: true,
								kind: 'folder',
							});
						}
						break;
					case 'rename':
						startRenameDraft({
							name: target.name,
							path: target.path,
							is_dir: target.kind === 'folder',
							kind: target.kind === 'folder' ? 'folder' : fileKindFromPath(target.path),
						});
						break;
					case 'reveal':
						await revealInExplorer(target.path);
						break;
					case 'copy-path':
						await navigator.clipboard?.writeText(target.path);
						break;
					case 'copy-relative-path':
						await navigator.clipboard?.writeText(
							activeRoot ? relativePath(activeRoot.path, target.path) : target.path
						);
						break;
					case 'delete': {
						const confirmed = await confirmDeleteTarget(target);
						if (!confirmed) {
							break;
						}

						await deletePath(target.path);

						if (pathIsDeletedTarget(target, openFilePath)) {
							setOpenFile(null);
							setOpenFilePath(null);
						}
						updateUnsavedFileDrafts((current) => {
							const next: UnsavedFileDrafts = {};
							Object.entries(current).forEach(([key, draft]) => {
								if (!pathIsDeletedTarget(target, draft.path)) {
									next[key] = draft;
								}
							});
							return next;
						});
						setSelectedFolderPath((current) =>
							pathIsDeletedTarget(target, current) ? parentPath(target.path) : current
						);
						setFocusedEntry((current) =>
							pathIsDeletedTarget(target, current?.path) ? null : current
						);
						setExpanded((current) => {
							const next = new Set<string>();
							current.forEach((path) => {
								if (!pathIsDeletedTarget(target, path)) {
									next.add(path);
								}
							});
							return next;
						});
						setChildrenCache((current) => {
							const next: Record<string, Entry[]> = {};
							Object.entries(current).forEach(([path, entries]) => {
								if (!pathIsDeletedTarget(target, path)) {
									next[path] = entries;
								}
							});
							return next;
						});

						setRecents((current) =>
							current
								.filter((item) => !pathIsDeletedTarget(target, item.path))
								.map((item) => ({
									...item,
									lastFile:
										item.lastFile && pathIsDeletedTarget(target, item.lastFile.path)
											? undefined
											: item.lastFile,
									recentFiles: item.recentFiles?.filter(
										(file) => !pathIsDeletedTarget(target, file.path)
									),
								}))
						);

						if (pathIsDeletedTarget(target, activeRoot?.path)) {
							const fallbackRoot =
								locations.find((location) => !pathIsDeletedTarget(target, location.path)) ?? null;
							setActiveRoot(fallbackRoot);
							setSelectedFolderPath(fallbackRoot?.path ?? null);
							if (fallbackRoot) {
								await loadFolder(fallbackRoot.path, { force: true });
							}
						} else {
							await refreshFolder(parentPath(target.path));
						}
						break;
					}
					default:
						break;
				}
			} catch (cause) {
				setError(`${String(cause)}`);
			}
		},
		[
			activeRoot,
			closeContextMenu,
			contextMenuRecent,
			loadFolder,
			locations,
			openFileAtPath,
			openFilePath,
			pinFolder,
			refreshFolder,
			removeRecentItem,
			selectLocation,
			setActiveRoot,
			setChildrenCache,
			setError,
			setExpanded,
			setFocusedEntry,
			setOpenFile,
			setOpenFilePath,
			setRecents,
			setSelectedFolderPath,
			startCreateDraft,
			startRenameDraft,
			updateUnsavedFileDrafts,
		]
	);
}
