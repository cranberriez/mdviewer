import { useCallback, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { readFile, writeFile } from '../api/filesApi';
import type { FileViewMode } from '../../file-actions/components/FileActionControls';
import { normalizeMarkdownForSave } from '../../preview/markdownDocument';
import type { OpenFile } from '../../../shared/types/files';
import { comparablePath, fileKindFromPath, fileName, parentPath } from '../../../shared/utils/path';
import { selectOpenFileStatus, useFileStore, type UnsavedFileDrafts } from '../state/useFileStore';

export type { UnsavedFileDrafts } from '../state/useFileStore';

interface UseOpenFileControllerOptions {
	activeRoot: { path: string; name: string } | null;
	initialOpenFilePath?: string | null;
	onError: (message: string | null) => void;
	onRecordFileRecent: (
		root: { path: string; name: string },
		file: { path: string; name: string; kind: Exclude<OpenFile['kind'], 'folder'> }
	) => void;
	onSelectedFolderPathChange: (path: string | null) => void;
	onViewModeChange: (mode: FileViewMode) => void;
}

export function useOpenFileController({
	activeRoot,
	initialOpenFilePath,
	onError,
	onRecordFileRecent,
	onSelectedFolderPathChange,
	onViewModeChange,
}: UseOpenFileControllerOptions) {
	const { dirty, openFile, openFilePath, renderedMarkdown, saving, unsavedFileDrafts } =
		useFileStore(useShallow(selectOpenFileStatus));
	const hydrate = useFileStore((state) => state.hydrate);
	const setOpenFile = useFileStore((state) => state.setOpenFile);
	const setOpenFilePath = useFileStore((state) => state.setOpenFilePath);
	const setSaving = useFileStore((state) => state.setSaving);
	const storeUpdateOpenFileContent = useFileStore((state) => state.updateOpenFileContent);
	const updateUnsavedFileDrafts = useFileStore((state) => state.updateUnsavedFileDrafts);
	const autoSaveRef = useRef<{
		dirty: boolean;
		hasOpenFile: boolean;
		saveOpenFile: () => Promise<void>;
		saving: boolean;
	}>({
		dirty: false,
		hasOpenFile: false,
		saveOpenFile: async () => undefined,
		saving: false,
	});
	const unsavedFileDraftsRef = useRef<UnsavedFileDrafts>({});
	unsavedFileDraftsRef.current = unsavedFileDrafts;

	useEffect(() => {
		hydrate(initialOpenFilePath);
	}, [hydrate, initialOpenFilePath]);

	const saveOpenFile = useCallback(async () => {
		if (!openFile || saving) {
			return;
		}

		const originalContent = openFile.content;
		const contentToSave =
			openFile.kind === 'md' ? normalizeMarkdownForSave(originalContent) : originalContent;
		const fileToSave = { ...openFile, content: contentToSave };
		const draftKey = comparablePath(fileToSave.path);

		setSaving(true);
		onError(null);

		try {
			await writeFile(fileToSave.path, fileToSave.content);
			updateUnsavedFileDrafts((current) => {
				const currentDraft = current[draftKey];
				if (currentDraft && currentDraft.content !== originalContent) {
					return current;
				}

				const next = { ...current };
				delete next[draftKey];
				return next;
			});
		} catch (cause) {
			onError(`Unable to save file: ${String(cause)}`);
		} finally {
			setSaving(false);
		}
	}, [onError, openFile, saving, updateUnsavedFileDrafts]);

	autoSaveRef.current = {
		dirty,
		hasOpenFile: Boolean(openFile),
		saveOpenFile,
		saving,
	};

	useEffect(() => {
		const interval = window.setInterval(() => {
			const autoSave = autoSaveRef.current;
			if (!autoSave.hasOpenFile || !autoSave.dirty || autoSave.saving) {
				return;
			}

			void autoSave.saveOpenFile();
		}, 5000);

		return () => {
			window.clearInterval(interval);
		};
	}, []);

	const openFileAtPath = useCallback(
		async (path: string, options?: { mode?: FileViewMode; skipRecent?: boolean }) => {
			onError(null);
			setOpenFilePath(path);
			onSelectedFolderPathChange(parentPath(path));

			try {
				const content = await readFile(path);
				const draft = unsavedFileDraftsRef.current[comparablePath(path)];
				const kind = fileKindFromPath(path);
				setOpenFile({
					path,
					name: fileName(path),
					content: draft?.content ?? content,
					kind,
				});
				if (options?.mode) {
					onViewModeChange(options.mode);
				}
				if (activeRoot && !options?.skipRecent) {
					onRecordFileRecent(
						{ path: activeRoot.path, name: activeRoot.name },
						{ path, name: fileName(path), kind }
					);
				}
			} catch (cause) {
				setOpenFile(null);
				setOpenFilePath(null);
				onError(`Unable to read file: ${String(cause)}`);
			}
		},
		[activeRoot, onError, onRecordFileRecent, onSelectedFolderPathChange, onViewModeChange]
	);

	const updateOpenFileContent = useCallback(
		(content: string) => {
			storeUpdateOpenFileContent(content);
		},
		[storeUpdateOpenFileContent]
	);

	return {
		dirty,
		openFile,
		openFilePath,
		renderedMarkdown,
		saving,
		setOpenFile,
		setOpenFilePath,
		unsavedFileDrafts,
		unsavedFileDraftsRef,
		updateUnsavedFileDrafts,
		openFileAtPath,
		saveOpenFile,
		updateOpenFileContent,
	};
}
