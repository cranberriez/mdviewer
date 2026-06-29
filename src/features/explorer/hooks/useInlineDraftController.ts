import { useCallback } from 'react';
import { createFile, createFolder, renamePath } from '../../files/api/filesApi';
import type { OpenFile, Entry } from '../../../shared/types/files';
import {
	comparablePath,
	containsPath,
	fileExtension,
	fileKindFromPath,
	fileName,
	isVisibleFileName,
	joinPath,
	parentPath,
	rebasePath,
} from '../../../shared/utils/path';
import type { FileViewMode } from '../../file-actions/components/FileActionControls';
import type { UnsavedFileDrafts } from '../../files/hooks/useOpenFileController';
import { useDraftStore } from '../state/useDraftStore';

interface UseInlineDraftControllerOptions {
	activeRootPath?: string;
	expanded: Set<string>;
	openFilePath: string | null;
	loadFolder: (path: string, options?: { quiet?: boolean; force?: boolean }) => Promise<void>;
	refreshFolder: (path: string) => Promise<void>;
	openFileAtPath: (
		path: string,
		options?: { mode?: FileViewMode; skipRecent?: boolean }
	) => Promise<void>;
	onError: (message: string) => void;
	onExpandedChange: (updater: (current: Set<string>) => Set<string>) => void;
	onFocusedEntryChange: (updater: (current: Entry | null) => Entry | null) => void;
	onOpenFileChange: (file: OpenFile | null) => void;
	onOpenFilePathChange: (path: string | null) => void;
	onUnsavedFileDraftsChange: (updater: (current: UnsavedFileDrafts) => UnsavedFileDrafts) => void;
}

function confirmExtensionIfNeeded(name: string, kind: 'file' | 'folder') {
	if (kind === 'folder' || isVisibleFileName(name)) {
		return true;
	}

	const ext = fileExtension(name);
	const detail = ext ? `".${ext}" files` : 'files without a .md, .markdown, or .txt extension';
	return window.confirm(
		`"${name}" will not be visible in Markdown Viewer because ${detail} aren't shown here.\n\nCreate it anyway?`
	);
}

function defaultCreateName(rawName: string, kind: 'file' | 'folder') {
	if (kind === 'folder') {
		return rawName || 'New Folder';
	}
	return !rawName || rawName.toLowerCase() === '.md' ? 'New File.md' : rawName;
}

export function useInlineDraftController({
	activeRootPath,
	expanded,
	openFilePath,
	loadFolder,
	refreshFolder,
	openFileAtPath,
	onError,
	onExpandedChange,
	onFocusedEntryChange,
	onOpenFileChange,
	onOpenFilePathChange,
	onUnsavedFileDraftsChange,
}: UseInlineDraftControllerOptions) {
	const draft = useDraftStore((state) => state.draft);
	const setDraft = useDraftStore((state) => state.setDraft);

	const ensureFolderOpen = useCallback(
		async (path: string) => {
			if (!expanded.has(path)) {
				onExpandedChange((current) => new Set(current).add(path));
			}
			await loadFolder(path);
		},
		[expanded, loadFolder, onExpandedChange]
	);

	const startCreateDraft = useCallback(
		async (parentPath: string, kind: 'file' | 'folder') => {
			const isRoot = activeRootPath === parentPath;
			if (!isRoot) {
				await ensureFolderOpen(parentPath);
			}

			setDraft({
				parentPath,
				mode: 'create',
				kind,
				initialValue: kind === 'file' ? '.md' : '',
				selection: 'start',
			});
		},
		[activeRootPath, ensureFolderOpen]
	);

	const startRenameDraft = useCallback((entry: Entry) => {
		setDraft({
			parentPath: parentPath(entry.path),
			mode: 'rename',
			kind: entry.is_dir ? 'folder' : 'file',
			initialValue: entry.name,
			selection: entry.is_dir ? 'all' : 'name',
			targetPath: entry.path,
		});
	}, []);

	const cancelDraft = useCallback(() => {
		setDraft(null);
	}, []);

	const submitDraft = useCallback(
		async (rawValue: string) => {
			const current = draft;
			if (!current) {
				return;
			}

			const rawName = rawValue.trim();
			const name = current.mode === 'create' ? defaultCreateName(rawName, current.kind) : rawName;
			setDraft(null);

			if (!name) {
				return;
			}
			if (/[\\/]/.test(name)) {
				onError('Names cannot contain slashes.');
				return;
			}

			try {
				if (current.mode === 'create') {
					if (!confirmExtensionIfNeeded(name, current.kind)) {
						return;
					}

					const targetPath = joinPath(current.parentPath, name);
					if (current.kind === 'folder') {
						await createFolder(targetPath);
					} else {
						await createFile(targetPath);
					}

					await refreshFolder(current.parentPath);

					if (current.kind === 'file' && isVisibleFileName(name)) {
						await openFileAtPath(targetPath, { mode: 'edit' });
					}
					return;
				}

				const originalPath = current.targetPath;
				if (!originalPath || name === fileName(originalPath)) {
					return;
				}
				if (current.kind === 'file' && !confirmExtensionIfNeeded(name, 'file')) {
					return;
				}

				const targetPath = joinPath(current.parentPath, name);
				await renamePath(originalPath, targetPath);
				await refreshFolder(current.parentPath);

				onUnsavedFileDraftsChange((drafts) => {
					const next = { ...drafts };

					Object.entries(drafts).forEach(([key, fileDraft]) => {
						const draftIsAffected =
							current.kind === 'folder'
								? containsPath(originalPath, fileDraft.path)
								: comparablePath(fileDraft.path) === comparablePath(originalPath);

						if (!draftIsAffected) {
							return;
						}

						delete next[key];

						const nextPath =
							current.kind === 'folder'
								? rebasePath(fileDraft.path, originalPath, targetPath)
								: targetPath;

						if (!isVisibleFileName(nextPath)) {
							return;
						}

						next[comparablePath(nextPath)] = {
							...fileDraft,
							path: nextPath,
							name: fileName(nextPath),
							kind: fileKindFromPath(nextPath) as OpenFile['kind'],
						};
					});

					return next;
				});

				onFocusedEntryChange((focused) =>
					focused?.path === originalPath ? { ...focused, name, path: targetPath } : focused
				);

				if (
					openFilePath &&
					(current.kind === 'folder'
						? containsPath(originalPath, openFilePath)
						: comparablePath(openFilePath) === comparablePath(originalPath))
				) {
					const nextOpenPath =
						current.kind === 'folder'
							? rebasePath(openFilePath, originalPath, targetPath)
							: targetPath;

					if (isVisibleFileName(nextOpenPath)) {
						await openFileAtPath(nextOpenPath);
					} else {
						onOpenFileChange(null);
						onOpenFilePathChange(null);
					}
				}
			} catch (cause) {
				onError(`${String(cause)}`);
			}
		},
		[
			draft,
			onError,
			onFocusedEntryChange,
			onOpenFileChange,
			onOpenFilePathChange,
			onUnsavedFileDraftsChange,
			openFileAtPath,
			openFilePath,
			refreshFolder,
		]
	);

	return {
		draft,
		cancelDraft,
		startCreateDraft,
		startRenameDraft,
		submitDraft,
	};
}
