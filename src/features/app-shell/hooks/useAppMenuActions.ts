import { useCallback, useMemo } from 'react';
import { revealInExplorer } from '../../files/api/filesApi';
import { selectOpenFileStatus, useFileStore } from '../../files/state/useFileStore';
import { useExplorerStore } from '../../explorer/state/useExplorerStore';
import { useUiStore } from '../state/useUiStore';
import { recentItemKind, type RecentItem } from '../../../shared/state/persistence';
import { useSavedLocationsStore } from '../../saved-locations/state/useSavedLocationsStore';

const execEditCommand = document.execCommand.bind(document) as (
	commandId: string,
	showUI?: boolean,
	value?: string
) => boolean;

interface FindControls {
	setOpen: (open: boolean) => void;
}

interface UseAppMenuActionsOptions {
	find: FindControls;
	openFolderAsRoot: () => Promise<void>;
	openRecent: (item: RecentItem) => Promise<void>;
	onOpenPreferences: () => void;
	saveOpenFile: () => Promise<void>;
	startCreateDraft: (parentPath: string, kind: 'file' | 'folder') => Promise<void>;
}

export function useAppMenuActions({
	find,
	openFolderAsRoot,
	openRecent,
	onOpenPreferences,
	saveOpenFile,
	startCreateDraft,
}: UseAppMenuActionsOptions) {
	const activeRootPath = useExplorerStore((state) => state.activeRoot?.path);
	const barMerged = useUiStore((state) => state.barMerged);
	const dirty = useFileStore((state) => selectOpenFileStatus(state).dirty);
	const explorerHidden = useUiStore((state) => state.explorerHidden);
	const mode = useUiStore((state) => state.mode);
	const openFile = useFileStore((state) => state.openFile);
	const openFilePath = useFileStore((state) => state.openFilePath);
	const outlinePanelVisible = useUiStore((state) => state.outlinePanelVisible);
	const selectedFolderPath = useExplorerStore((state) => state.selectedFolderPath);
	const setBarMerged = useUiStore((state) => state.setBarMerged);
	const setExplorerHidden = useUiStore((state) => state.setExplorerHidden);
	const setMode = useUiStore((state) => state.setMode);
	const setOutlinePanelVisible = useUiStore((state) => state.setOutlinePanelVisible);
	const setSidebarMode = useUiStore((state) => state.setSidebarMode);
	const setTheme = useUiStore((state) => state.setTheme);
	const theme = useUiStore((state) => state.theme);
	const recents = useSavedLocationsStore((state) => state.recents);
	const recentRoots = useMemo(
		() => recents.filter((item) => recentItemKind(item) === 'root'),
		[recents]
	);

	const handleMenuAction = useCallback(
		(id: string) => {
			const targetFolder = selectedFolderPath ?? activeRootPath ?? null;
			if (id.startsWith('open-recent-')) {
				const index = Number.parseInt(id.slice('open-recent-'.length), 10);
				const recent = recentRoots[index];
				if (recent) {
					void openRecent(recent);
				}
				return;
			}

			switch (id) {
				case 'new-file':
					if (targetFolder) {
						void startCreateDraft(targetFolder, 'file');
					}
					return;
				case 'new-folder':
					if (targetFolder) {
						void startCreateDraft(targetFolder, 'folder');
					}
					return;
				case 'open-folder':
					void openFolderAsRoot();
					return;
				case 'preferences':
					onOpenPreferences();
					return;
				case 'save':
					void saveOpenFile();
					return;
				case 'reveal':
					if (openFilePath) {
						void revealInExplorer(openFilePath);
					}
					return;
				case 'find':
					if (openFile) {
						find.setOpen(true);
					}
					return;
				case 'find-in-files':
					setExplorerHidden(false);
					setSidebarMode('search');
					return;
				case 'toggle-explorer':
					setExplorerHidden((hidden) => !hidden);
					return;
				case 'toggle-outline-panel':
					setOutlinePanelVisible((visible) => !visible);
					return;
				case 'mode-preview':
					setMode('preview');
					return;
				case 'mode-edit':
					setMode('edit');
					return;
				case 'mode-code':
					setMode('code');
					return;
				case 'toggle-bar':
					setBarMerged((merged) => !merged);
					return;
				case 'toggle-theme':
					setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
					return;
				case 'undo':
					execEditCommand('undo');
					return;
				case 'redo':
					execEditCommand('redo');
					return;
				case 'cut':
					execEditCommand('cut');
					return;
				case 'copy':
					execEditCommand('copy');
					return;
				case 'paste':
					if (!execEditCommand('paste')) {
						void navigator.clipboard
							?.readText()
							.then((text) => execEditCommand('insertText', false, text))
							.catch(() => undefined);
					}
					return;
				default:
					return;
			}
		},
		[
			activeRootPath,
			find,
			openFile,
			openFilePath,
			openFolderAsRoot,
			openRecent,
			onOpenPreferences,
			recentRoots,
			saveOpenFile,
			selectedFolderPath,
			setBarMerged,
			setExplorerHidden,
			setMode,
			setOutlinePanelVisible,
			setSidebarMode,
			setTheme,
			startCreateDraft,
		]
	);

	const menuState = useMemo(
		() => ({
			hasOpenFile: Boolean(openFile),
			dirty,
			isMarkdown: openFile?.kind === 'md',
			isEditing: mode === 'edit' || mode === 'code',
			canCopy: Boolean(openFile),
			explorerHidden,
			outlinePanelVisible,
			barMerged,
			theme,
			mode,
			recentRoots,
		}),
		[barMerged, dirty, explorerHidden, mode, openFile, outlinePanelVisible, recentRoots, theme]
	);

	return { handleMenuAction, menuState };
}
