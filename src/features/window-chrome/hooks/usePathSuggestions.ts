import { useEffect, useMemo, useState } from 'react';
import { folderEntry, readFolder } from '../../files/api/filesApi';
import type { Entry } from '../../../shared/types/files';

export interface PathSuggestion {
	id: string;
	kind: 'current' | 'file' | 'folder' | 'parent';
	label: string;
	path: string;
}

interface UsePathSuggestionsOptions {
	currentPath?: string;
	currentPathKind: 'file' | 'folder';
	draft: string;
	enabled: boolean;
}

const MAX_NEARBY_FOLDER_SUGGESTIONS = 10;
const MAX_NEARBY_FILE_SUGGESTIONS = 10;
const SUGGESTION_DELAY_MS = 100;

function unquotePath(value: string) {
	const trimmed = value.trim();
	const quote = trimmed[0];
	if ((quote === '"' || quote === "'") && trimmed[trimmed.length - 1] === quote) {
		return trimmed.slice(1, -1).trim();
	}
	return trimmed;
}

function parentCandidate(value: string) {
	let candidate = value.replace(/[\\/]+$/, '');
	const separatorIndex = Math.max(candidate.lastIndexOf('\\'), candidate.lastIndexOf('/'));
	if (separatorIndex < 0) {
		return null;
	}

	const separator = candidate[separatorIndex];
	candidate = candidate.slice(0, separatorIndex);
	if (/^[a-z]:$/i.test(candidate)) {
		return `${candidate}${separator}`;
	}
	if (!candidate && value.startsWith(separator)) {
		return separator;
	}
	return candidate || null;
}

function typedFragment(draft: string, basePath: string) {
	const normalizedDraft = draft.replace(/\\/g, '/');
	const normalizedBase = basePath.replace(/\\/g, '/').replace(/\/+$/, '');
	if (!normalizedDraft.toLowerCase().startsWith(normalizedBase.toLowerCase())) {
		return '';
	}
	return normalizedDraft.slice(normalizedBase.length).replace(/^\/+/, '').split('/')[0] ?? '';
}

function comparablePath(value: string) {
	return unquotePath(value).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function nearbyEntries(entries: Entry[], fragment: string) {
	const query = fragment.toLowerCase();
	const ranked = entries
		.filter((entry) => !query || entry.name.toLowerCase().startsWith(query))
		.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
	return [
		...ranked.filter((entry) => entry.is_dir).slice(0, MAX_NEARBY_FOLDER_SUGGESTIONS),
		...ranked.filter((entry) => !entry.is_dir).slice(0, MAX_NEARBY_FILE_SUGGESTIONS),
	];
}

async function resolveNearbySuggestions(draft: string) {
	let candidate = unquotePath(draft);
	const visited = new Set<string>();

	while (candidate && !visited.has(candidate.toLowerCase())) {
		visited.add(candidate.toLowerCase());
		try {
			const base = await folderEntry(candidate);
			const parentDirectory = parentCandidate(base.path);
			let entries: Entry[] = [];
			try {
				entries = await readFolder(base.path);
			} catch {
				// The folder still makes a useful completion even when its children
				// cannot be listed because of permissions or a transient IO error.
			}
			const fragment = typedFragment(draft, base.path);
			return [
				...(!fragment && parentDirectory
					? [
							{
								id: `parent:${parentDirectory}`,
								kind: 'parent' as const,
								label: '..',
								path: parentDirectory,
							},
						]
					: []),
				...nearbyEntries(entries, fragment).map<PathSuggestion>((entry) => ({
					id: `${entry.is_dir ? 'folder' : 'file'}:${entry.path}`,
					kind: entry.is_dir ? 'folder' : 'file',
					label: entry.name,
					path: entry.path,
				})),
			];
		} catch {
			candidate = parentCandidate(candidate) ?? '';
		}
	}

	return [];
}

export function usePathSuggestions({
	currentPath,
	currentPathKind,
	draft,
	enabled,
}: UsePathSuggestionsOptions) {
	const contextSuggestions = useMemo<PathSuggestion[]>(() => {
		if (!currentPath) {
			return [];
		}
		const currentDirectory =
			currentPathKind === 'folder' ? currentPath : parentCandidate(currentPath);
		if (!currentDirectory) {
			return [];
		}
		const parentDirectory = parentCandidate(currentDirectory);
		const typedPath = unquotePath(draft);
		if (typedPath && comparablePath(typedPath) !== comparablePath(currentDirectory)) {
			return [];
		}
		return [
			...(parentDirectory
				? [
						{
							id: `parent:${parentDirectory}`,
							kind: 'parent' as const,
							label: '..',
							path: parentDirectory,
						},
					]
				: []),
			...(!typedPath
				? [
						{
							id: `current:${currentDirectory}`,
							kind: 'current' as const,
							label: currentDirectory,
							path: currentDirectory,
						},
					]
				: []),
		];
	}, [currentPath, currentPathKind, draft]);
	const [nearbySuggestions, setNearbySuggestions] = useState<PathSuggestion[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!enabled || !unquotePath(draft)) {
			setNearbySuggestions([]);
			setLoading(false);
			return;
		}

		let cancelled = false;
		setNearbySuggestions([]);
		setLoading(true);
		const timeout = window.setTimeout(() => {
			void resolveNearbySuggestions(draft).then((suggestions) => {
				if (cancelled) {
					return;
				}
				setNearbySuggestions(suggestions);
				setLoading(false);
			});
		}, SUGGESTION_DELAY_MS);

		return () => {
			cancelled = true;
			window.clearTimeout(timeout);
		};
	}, [draft, enabled]);

	return {
		loading,
		suggestions: nearbySuggestions.length > 0 ? nearbySuggestions : contextSuggestions,
	};
}
