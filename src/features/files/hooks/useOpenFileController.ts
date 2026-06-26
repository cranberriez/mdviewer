import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { readFile, writeFile } from '../api/filesApi';
import type { FileViewMode } from '../../file-actions/components/FileActionControls';
import { markdown } from '../../preview/markdown';
import type { OpenFile } from '../../../shared/types/files';
import { comparablePath, fileKindFromPath, fileName, parentPath } from '../../../shared/utils/path';

export type UnsavedFileDrafts = Record<string, OpenFile>;

interface UseOpenFileControllerOptions {
	activeRoot: { path: string; name: string } | null;
	afterOpenRef?: RefObject<(() => void) | null>;
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
	afterOpenRef,
	initialOpenFilePath,
	onError,
	onRecordFileRecent,
	onSelectedFolderPathChange,
	onViewModeChange,
}: UseOpenFileControllerOptions) {
	const [openFile, setOpenFile] = useState<OpenFile | null>(null);
	const [openFilePath, setOpenFilePath] = useState<string | null>(
		() => initialOpenFilePath ?? null
	);
	const [unsavedFileDrafts, setUnsavedFileDrafts] = useState<UnsavedFileDrafts>({});
	const [saving, setSaving] = useState(false);
	const unsavedFileDraftsRef = useRef<UnsavedFileDrafts>({});

	const updateUnsavedFileDrafts = useCallback(
		(updater: (current: UnsavedFileDrafts) => UnsavedFileDrafts) => {
			setUnsavedFileDrafts((current) => {
				const next = updater(current);
				unsavedFileDraftsRef.current = next;
				return next;
			});
		},
		[]
	);

	useEffect(() => {
		unsavedFileDraftsRef.current = unsavedFileDrafts;
	}, [unsavedFileDrafts]);

	const dirty = openFile ? Boolean(unsavedFileDrafts[comparablePath(openFile.path)]) : false;

	const renderedMarkdown = useMemo(() => {
		if (!openFile || openFile.kind !== 'md') {
			return '';
		}

		return markdown.render(openFile.content);
	}, [openFile]);

	const saveOpenFile = useCallback(async () => {
		if (!openFile || saving) {
			return;
		}

		const fileToSave = openFile;
		const draftKey = comparablePath(fileToSave.path);

		setSaving(true);
		onError(null);

		try {
			await writeFile(fileToSave.path, fileToSave.content);
			updateUnsavedFileDrafts((current) => {
				const currentDraft = current[draftKey];
				if (currentDraft && currentDraft.content !== fileToSave.content) {
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
				afterOpenRef?.current?.();
			} catch (cause) {
				setOpenFile(null);
				setOpenFilePath(null);
				onError(`Unable to read file: ${String(cause)}`);
			}
		},
		[
			activeRoot,
			afterOpenRef,
			onError,
			onRecordFileRecent,
			onSelectedFolderPathChange,
			onViewModeChange,
		]
	);

	const updateOpenFileContent = useCallback(
		(content: string) => {
			if (!openFile) {
				return;
			}

			const nextFile = { ...openFile, content };
			const draftKey = comparablePath(openFile.path);

			setOpenFile(nextFile);
			updateUnsavedFileDrafts((current) => ({
				...current,
				[draftKey]: nextFile,
			}));
		},
		[openFile, updateUnsavedFileDrafts]
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
