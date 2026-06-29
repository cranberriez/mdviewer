import type { Entry, OpenFile } from '../types/files';

export function parentPath(path: string) {
	const parts = path.split(/[\\/]/);
	parts.pop();
	return parts.join('\\');
}

export function parentName(path: string) {
	return parentPath(path).split(/[\\/]/).pop() ?? '';
}

export function comparablePath(path: string) {
	return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

export function containsPath(rootPath: string, path: string) {
	const root = comparablePath(rootPath);
	const child = comparablePath(path);

	return child === root || child.startsWith(`${root}/`);
}

export function rebasePath(path: string, fromRoot: string, toRoot: string) {
	if (comparablePath(path) === comparablePath(fromRoot)) {
		return toRoot;
	}

	return `${toRoot}${path.slice(fromRoot.length)}`;
}

export function fileName(path: string) {
	return path.split(/[\\/]/).pop() || path;
}

export function fileKind(entry: Entry): OpenFile['kind'] {
	return entry.kind === 'md' ? 'md' : 'text';
}

export function fileKindFromPath(path: string): OpenFile['kind'] {
	const extension = path.split('.').pop()?.toLowerCase();
	return extension === 'md' || extension === 'markdown' ? 'md' : 'text';
}

/** Path separator used by the host platform (Windows uses backslashes). */
function pathSeparator(referencePath: string) {
	return referencePath.includes('\\') ? '\\' : '/';
}

/** Join a parent folder path with a child name using the parent's separator. */
export function joinPath(parent: string, child: string) {
	const separator = pathSeparator(parent);
	const trimmed = parent.replace(/[\\/]+$/, '');
	return `${trimmed}${separator}${child}`;
}

/** Extensions the app can read and display in the explorer/preview. */
export const VISIBLE_EXTENSIONS = ['md', 'markdown', 'txt'] as const;

/**
 * Path of `target` relative to `root`, using the root's separator. When the
 * target isn't inside the root (shouldn't happen for tree items, but can for
 * pinned folders elsewhere on disk) the absolute target path is returned.
 */
export function relativePath(root: string, target: string) {
	const separator = root.includes('\\') ? '\\' : '/';
	const normalize = (value: string) => value.replace(/[\\/]+$/, '').replace(/\\/g, '/');

	const normalizedRoot = normalize(root);
	const normalizedTarget = normalize(target);

	if (normalizedTarget.toLowerCase() === normalizedRoot.toLowerCase()) {
		return '.';
	}

	const prefix = `${normalizedRoot.toLowerCase()}/`;
	if (!normalizedTarget.toLowerCase().startsWith(prefix)) {
		// Outside the root — fall back to the absolute path.
		return target;
	}

	const relative = normalizedTarget.slice(normalizedRoot.length + 1);
	return separator === '\\' ? relative.replace(/\//g, '\\') : relative;
}

/** Lowercased extension without the dot, or "" if the name has none. */
export function fileExtension(name: string) {
	const base = name.split(/[\\/]/).pop() ?? name;
	const dot = base.lastIndexOf('.');
	if (dot <= 0) {
		return '';
	}
	return base.slice(dot + 1).toLowerCase();
}

/**
 * True when a file name ends in an extension the app can show. Names without an
 * extension (e.g. plain "notes") are not visible.
 */
export function isVisibleFileName(name: string) {
	return (VISIBLE_EXTENSIONS as readonly string[]).includes(fileExtension(name));
}
