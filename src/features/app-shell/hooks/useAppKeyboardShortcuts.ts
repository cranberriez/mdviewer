import { useEffect } from 'react';
import type { Entry } from '../../../shared/types/files';
import type { InlineDraft } from '../../explorer/components/TreeInlineInput';
import type { ContextMenuAction, ContextMenuTarget } from '../../explorer/components/ContextMenu';
import { entryToContextTarget } from '../../explorer/utils/contextTargets';

interface FindControls {
	setOpen: (open: boolean) => void;
}

interface UseAppKeyboardShortcutsOptions {
	draft: InlineDraft | null;
	find: FindControls;
	focusedEntry: Entry | null;
	onFindInFiles: () => void;
	onSave: () => void;
	onContextAction: (action: ContextMenuAction, target: ContextMenuTarget) => void;
	onToggleFolder: (entry: Entry) => void;
}

export function useAppKeyboardShortcuts({
	draft,
	find,
	focusedEntry,
	onFindInFiles,
	onSave,
	onContextAction,
	onToggleFolder,
}: UseAppKeyboardShortcutsOptions) {
	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
				event.preventDefault();
				onSave();
			}

			if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
				event.preventDefault();
				onFindInFiles();
				return;
			}

			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
				event.preventDefault();
				find.setOpen(true);
			}
		}

		window.addEventListener('keydown', handleKeyDown);

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, [find, onFindInFiles, onSave]);

	useEffect(() => {
		function handleExplorerKeyDown(event: KeyboardEvent) {
			if (!focusedEntry || draft) {
				return;
			}

			const active = document.activeElement as HTMLElement | null;
			const insideExplorer = Boolean(active?.closest('.sidebar'));
			if (!insideExplorer || active?.classList.contains('tree-inline-input')) {
				return;
			}

			const target = entryToContextTarget(focusedEntry);

			if (event.key === 'F2') {
				event.preventDefault();
				onContextAction('rename', target);
				return;
			}

			if (event.key === 'Delete') {
				event.preventDefault();
				onContextAction('delete', target);
				return;
			}

			if (event.key === 'Enter') {
				event.preventDefault();
				if (focusedEntry.is_dir) {
					onToggleFolder(focusedEntry);
				} else {
					onContextAction('open', target);
				}
				return;
			}

			if (event.shiftKey && event.altKey && event.key.toLowerCase() === 'r') {
				event.preventDefault();
				onContextAction('reveal', target);
				return;
			}

			if (event.shiftKey && event.altKey && event.key.toLowerCase() === 'c') {
				event.preventDefault();
				onContextAction('copy-path', target);
			}
		}

		window.addEventListener('keydown', handleExplorerKeyDown);

		return () => {
			window.removeEventListener('keydown', handleExplorerKeyDown);
		};
	}, [draft, focusedEntry, onContextAction, onToggleFolder]);
}
