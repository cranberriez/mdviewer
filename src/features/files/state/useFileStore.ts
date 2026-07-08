import { create } from 'zustand';
import { markdown } from '../../preview/markdown';
import { stripYamlFrontmatterForPreview } from '../../preview/markdownDocument';
import type { OpenFile } from '../../../shared/types/files';
import { comparablePath } from '../../../shared/utils/path';

export type UnsavedFileDrafts = Record<string, OpenFile>;

type DraftUpdater = (current: UnsavedFileDrafts) => UnsavedFileDrafts;

interface FileState {
	openFile: OpenFile | null;
	openFilePath: string | null;
	renderedMarkdown: string;
	saving: boolean;
	unsavedFileDrafts: UnsavedFileDrafts;
}

interface FileActions {
	hydrate: (initialOpenFilePath?: string | null) => void;
	setOpenFile: (file: OpenFile | null) => void;
	setOpenFilePath: (path: string | null) => void;
	setSaving: (saving: boolean) => void;
	updateOpenFileContent: (content: string) => void;
	updateUnsavedFileDrafts: (updater: DraftUpdater) => void;
}

export type FileStore = FileState & FileActions;

function renderMarkdown(file: OpenFile | null) {
	return file?.kind === 'md' ? markdown.render(stripYamlFrontmatterForPreview(file.content)) : '';
}

export const useFileStore = create<FileStore>()((set) => ({
	openFile: null,
	openFilePath: null,
	renderedMarkdown: '',
	saving: false,
	unsavedFileDrafts: {},

	hydrate: (initialOpenFilePath) =>
		set({
			openFile: null,
			openFilePath: initialOpenFilePath ?? null,
			renderedMarkdown: '',
			saving: false,
			unsavedFileDrafts: {},
		}),
	setOpenFile: (openFile) => set({ openFile, renderedMarkdown: renderMarkdown(openFile) }),
	setOpenFilePath: (openFilePath) => set({ openFilePath }),
	setSaving: (saving) => set({ saving }),
	updateOpenFileContent: (content) =>
		set((state) => {
			if (!state.openFile) {
				return {};
			}

			const openFile = { ...state.openFile, content };
			const draftKey = comparablePath(openFile.path);

			return {
				openFile,
				renderedMarkdown: renderMarkdown(openFile),
				unsavedFileDrafts: {
					...state.unsavedFileDrafts,
					[draftKey]: openFile,
				},
			};
		}),
	updateUnsavedFileDrafts: (updater) =>
		set((state) => ({
			unsavedFileDrafts: updater(state.unsavedFileDrafts),
		})),
}));

export const selectOpenFileStatus = (state: FileStore) => ({
	dirty: state.openFile
		? Boolean(state.unsavedFileDrafts[comparablePath(state.openFile.path)])
		: false,
	openFile: state.openFile,
	openFilePath: state.openFilePath,
	renderedMarkdown: state.renderedMarkdown,
	saving: state.saving,
	unsavedFileDrafts: state.unsavedFileDrafts,
});
