import { useCallback } from 'react';
import type { ExplorerHeaderMenuAction } from '../../explorer/components/context-menu/ExplorerHeaderContextMenu';
import type { SourcesHeaderMenuAction } from '../../explorer/components/context-menu/SourcesHeaderContextMenu';
import { useExplorerStore } from '../../explorer/state/useExplorerStore';
import { useMenuStore } from '../state/useMenuStore';
import { useUiStore } from '../state/useUiStore';

interface UseHeaderMenuActionsOptions {
	getCreateTargetFolder: () => string | null;
	openFolderAsRoot: () => Promise<void>;
	refreshFolder: (path: string) => Promise<void>;
	startCreateDraft: (parentPath: string, kind: 'file' | 'folder') => Promise<void>;
	toggleRootPin: () => void;
}

export function useHeaderMenuActions({
	getCreateTargetFolder,
	openFolderAsRoot,
	refreshFolder,
	startCreateDraft,
	toggleRootPin,
}: UseHeaderMenuActionsOptions) {
	const activeRoot = useExplorerStore((state) => state.activeRoot);
	const closeExplorerHeaderMenu = useMenuStore((state) => state.closeExplorerHeaderMenu);
	const closeSourcesHeaderMenu = useMenuStore((state) => state.closeSourcesHeaderMenu);
	const setError = useExplorerStore((state) => state.setError);
	const setSidebarMode = useUiStore((state) => state.setSidebarMode);
	const toggleExplorerFilter = useUiStore((state) => state.toggleExplorerFilter);
	const toggleExplorerHeaderAction = useUiStore((state) => state.toggleExplorerHeaderAction);
	const toggleSourcesHeaderAction = useUiStore((state) => state.toggleSourcesHeaderAction);

	const handleExplorerHeaderMenuAction = useCallback(
		async (action: ExplorerHeaderMenuAction) => {
			closeExplorerHeaderMenu();
			const targetFolder = getCreateTargetFolder();

			try {
				switch (action) {
					case 'new-file':
						if (targetFolder) {
							await startCreateDraft(targetFolder, 'file');
						}
						break;
					case 'new-folder':
						if (targetFolder) {
							await startCreateDraft(targetFolder, 'folder');
						}
						break;
					case 'refresh':
						if (activeRoot) {
							await refreshFolder(activeRoot.path);
						}
						break;
					case 'toggle-new-file':
						toggleExplorerHeaderAction('newFile');
						break;
					case 'toggle-new-folder':
						toggleExplorerHeaderAction('newFolder');
						break;
					case 'toggle-refresh':
						toggleExplorerHeaderAction('refresh');
						break;
					case 'toggle-hidden-items':
						toggleExplorerFilter('showHiddenItems');
						break;
					case 'toggle-non-text-files':
						toggleExplorerFilter('showNonTextFiles');
						break;
					default:
						break;
				}
			} catch (cause) {
				setError(`${String(cause)}`);
			}
		},
		[
			activeRoot,
			closeExplorerHeaderMenu,
			getCreateTargetFolder,
			refreshFolder,
			setError,
			startCreateDraft,
			toggleExplorerFilter,
			toggleExplorerHeaderAction,
		]
	);

	const handleSourcesHeaderMenuAction = useCallback(
		(action: SourcesHeaderMenuAction) => {
			closeSourcesHeaderMenu();

			switch (action) {
				case 'switch-explorer':
					setSidebarMode('explorer');
					break;
				case 'switch-search':
					setSidebarMode('search');
					break;
				case 'switch-outline':
					setSidebarMode('outline');
					break;
				case 'toggle-root-pin':
					toggleRootPin();
					break;
				case 'open-folder':
					void openFolderAsRoot();
					break;
				case 'toggle-search':
					toggleSourcesHeaderAction('search');
					break;
				case 'toggle-outline':
					toggleSourcesHeaderAction('outline');
					break;
				case 'toggle-pin':
					toggleSourcesHeaderAction('pin');
					break;
				default:
					break;
			}
		},
		[
			closeSourcesHeaderMenu,
			openFolderAsRoot,
			setSidebarMode,
			toggleRootPin,
			toggleSourcesHeaderAction,
		]
	);

	return { handleExplorerHeaderMenuAction, handleSourcesHeaderMenuAction };
}
