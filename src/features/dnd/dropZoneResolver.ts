import { fileName, parentPath } from '../../shared/utils/path';
import type { DropZone } from './dropTypes';

interface DropZoneResolverOptions {
	activeRootPath: string | null;
}

export function resolveDropZoneFromElement(
	element: Element | null,
	options: DropZoneResolverOptions
): DropZone | null {
	if (!element) {
		return null;
	}

	const zone = element.closest<HTMLElement>('[data-drop-zone]');
	if (!zone) {
		return null;
	}

	const kind = zone.getAttribute('data-drop-zone');

	if (kind === 'tree') {
		const path = zone.getAttribute('data-drop-path') ?? '';
		const isDir = zone.getAttribute('data-drop-isdir') === '1';
		const destDir = isDir ? path : parentPath(path);
		if (!destDir) {
			return null;
		}
		return { kind: 'tree-folder', destDir, label: fileName(destDir) || destDir };
	}

	if (kind === 'tree-blank') {
		const rootPath = zone.getAttribute('data-drop-path') || options.activeRootPath || '';
		if (!rootPath) {
			return null;
		}
		return { kind: 'tree-root', destDir: rootPath, label: fileName(rootPath) || 'root' };
	}

	if (kind === 'main') {
		return { kind: 'main', destDir: '', label: 'main' };
	}

	if (kind === 'home') {
		return { kind: 'home', destDir: '', label: 'home' };
	}

	return null;
}
