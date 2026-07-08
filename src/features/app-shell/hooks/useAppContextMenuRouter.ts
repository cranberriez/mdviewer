import { useCallback } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { RecentItem } from '../../../shared/state/persistence';
import { recentItemKind } from '../../../shared/state/persistence';
import type { Entry } from '../../../shared/types/files';
import { entryToContextTarget } from '../../explorer/utils/contextTargets';
import { useExplorerActions, useExplorerStore } from '../../explorer/state/useExplorerStore';
import { useMenuActions } from '../state/useMenuStore';

export type AppContextMenuRequest =
	| { kind: 'entry'; entry: Entry }
	| { kind: 'recent'; item: RecentItem }
	| { kind: 'root' }
	| { kind: 'saved'; location: Entry }
	| { kind: 'explorer-header' }
	| { kind: 'sources-header' };

interface UseAppContextMenuRouterOptions {
	cancelDraft: () => void;
}

export function useAppContextMenuRouter({ cancelDraft }: UseAppContextMenuRouterOptions) {
	const activeRoot = useExplorerStore((state) => state.activeRoot);
	const { setFocusedEntry } = useExplorerActions();
	const { openContextMenu, openExplorerHeaderMenu, openSavedMenu, openSourcesHeaderMenu } =
		useMenuActions();

	return useCallback(
		(request: AppContextMenuRequest, event: ReactMouseEvent) => {
			event.preventDefault();
			event.stopPropagation();

			switch (request.kind) {
				case 'entry':
					cancelDraft();
					setFocusedEntry(request.entry);
					openContextMenu(entryToContextTarget(request.entry, event.clientX, event.clientY));
					break;
				case 'recent': {
					const isFile = recentItemKind(request.item) === 'file';
					openContextMenu(
						{
							kind: isFile ? 'file' : 'folder',
							path: request.item.path,
							name: request.item.name,
							x: event.clientX,
							y: event.clientY,
						},
						{ variant: isFile ? 'recent-file' : 'recent-root', recent: request.item }
					);
					break;
				}
				case 'root':
					if (activeRoot) {
						cancelDraft();
						openContextMenu({
							kind: 'folder',
							path: activeRoot.path,
							name: activeRoot.name,
							x: event.clientX,
							y: event.clientY,
						});
					}
					break;
				case 'saved':
					openSavedMenu({
						location: request.location,
						x: event.clientX,
						y: event.clientY,
					});
					break;
				case 'explorer-header':
					if (activeRoot) {
						cancelDraft();
						openExplorerHeaderMenu({ x: event.clientX, y: event.clientY });
					}
					break;
				case 'sources-header':
					cancelDraft();
					openSourcesHeaderMenu({ x: event.clientX, y: event.clientY });
					break;
				default:
					break;
			}
		},
		[
			activeRoot,
			cancelDraft,
			openContextMenu,
			openExplorerHeaderMenu,
			openSavedMenu,
			openSourcesHeaderMenu,
			setFocusedEntry,
		]
	);
}
