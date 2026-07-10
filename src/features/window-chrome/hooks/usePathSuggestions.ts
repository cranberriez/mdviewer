import { useEffect, useMemo, useState } from 'react';
import { folderEntry, readFolder } from '../../files/api/filesApi';
import { recentItemKind } from '../../../shared/state/persistence';
import type { Entry } from '../../../shared/types/files';
import { useSavedLocationsStore } from '../../saved-locations/state/useSavedLocationsStore';

export type PathSuggestionMode = 'recent' | 'nearby';

export interface PathSuggestion {
	id: string;
	kind: 'base' | 'file' | 'folder' | 'recent';
	label: string;
	path: string;
}

interface UsePathSuggestionsOptions {
	draft: string;
	enabled: boolean;
	mode: PathSuggestionMode;
}

const MAX_RECENT_SUGGESTIONS = 8;
const MAX_NEARBY_SUGGESTIONS = 9;
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

function nearbyEntries(entries: Entry[], fragment: string) {
	const query = fragment.toLowerCase();
	return [...entries]
		.sort((left, right) => {
			if (left.is_dir !== right.is_dir) {
				return left.is_dir ? -1 : 1;
			}
			if (query) {
				const leftMatches = left.name.toLowerCase().startsWith(query);
				const rightMatches = right.name.toLowerCase().startsWith(query);
				if (leftMatches !== rightMatches) {
					return leftMatches ? -1 : 1;
				}
			}
			return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
		})
		.slice(0, MAX_NEARBY_SUGGESTIONS);
}

async function resolveNearbySuggestions(draft: string) {
	let candidate = unquotePath(draft);
	const visited = new Set<string>();

	while (candidate && !visited.has(candidate.toLowerCase())) {
		visited.add(candidate.toLowerCase());
		try {
			const base = await folderEntry(candidate);
			let entries: Entry[] = [];
			try {
				entries = await readFolder(base.path);
			} catch {
				// The folder still makes a useful completion even when its children
				// cannot be listed because of permissions or a transient IO error.
			}
			const fragment = typedFragment(draft, base.path);
			return [
				{
					id: `base:${base.path}`,
					kind: 'base' as const,
					label: base.path,
					path: base.path,
				},
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

export function usePathSuggestions({ draft, enabled, mode }: UsePathSuggestionsOptions) {
	const recents = useSavedLocationsStore((state) => state.recents);
	const recentSuggestions = useMemo<PathSuggestion[]>(
		() =>
			recents
				.filter((item) => recentItemKind(item) === 'root')
				.slice(0, MAX_RECENT_SUGGESTIONS)
				.map((item) => ({
					id: `recent:${item.path}`,
					kind: 'recent',
					label: item.name,
					path: item.path,
				})),
		[recents]
	);
	const [nearbySuggestions, setNearbySuggestions] = useState<PathSuggestion[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!enabled || mode === 'recent' || !unquotePath(draft)) {
			setNearbySuggestions([]);
			setLoading(false);
			return;
		}

		let cancelled = false;
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
	}, [draft, enabled, mode]);

	const showRecents = mode === 'recent' || !unquotePath(draft);
	return {
		loading: showRecents ? false : loading,
		suggestions: showRecents ? recentSuggestions : nearbySuggestions,
		suggestionMode: showRecents ? ('recent' as const) : ('nearby' as const),
	};
}
