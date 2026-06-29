import { confirm as confirmDialog } from '@tauri-apps/plugin-dialog';
import type { ContextMenuTarget } from '../components/ContextMenu';
import type { Entry } from '../../../shared/types/files';
import { comparablePath, containsPath } from '../../../shared/utils/path';

export function pathIsDeletedTarget(target: ContextMenuTarget, path?: string | null) {
	if (!path) {
		return false;
	}

	return target.kind === 'folder'
		? containsPath(target.path, path)
		: comparablePath(path) === comparablePath(target.path);
}

export function entryToContextTarget(entry: Entry, x = 0, y = 0): ContextMenuTarget {
	return {
		kind: entry.is_dir ? 'folder' : 'file',
		name: entry.name,
		path: entry.path,
		x,
		y,
	};
}

export function confirmDeleteTarget(target: ContextMenuTarget) {
	const description =
		target.kind === 'folder' ? `folder "${target.name}" and its contents` : `file "${target.name}"`;

	return confirmDialog(`Move ${description} to the Recycle Bin?`, {
		title: 'Move to Recycle Bin',
		kind: 'warning',
	});
}
