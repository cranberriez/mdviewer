import { useCallback, useRef, useState } from 'react';
import type { Entry, FileSearchMatch } from '../../../shared/types/files';
import type { FileViewMode } from '../../file-actions/components/FileActionControls';
import { searchFiles } from '../../files/api/filesApi';

interface MutableRef<T> {
	current: T;
}

interface UseCrossFileSearchOptions {
	activeRoot: Entry | null;
	openFileAtPath: (
		path: string,
		options?: { mode?: FileViewMode; skipRecent?: boolean }
	) => Promise<void>;
	pendingFindQueryRef: MutableRef<string | null>;
}

export function useCrossFileSearch({
	activeRoot,
	openFileAtPath,
	pendingFindQueryRef,
}: UseCrossFileSearchOptions) {
	const [searchQuery, setSearchQuery] = useState('');
	const [searchedQuery, setSearchedQuery] = useState('');
	const [searchResults, setSearchResults] = useState<FileSearchMatch[]>([]);
	const [searchLoading, setSearchLoading] = useState(false);
	const [searchError, setSearchError] = useState<string | null>(null);
	const [searchTruncated, setSearchTruncated] = useState(false);
	const searchRequestRef = useRef(0);

	const runCrossFileSearch = useCallback(async () => {
		const root = activeRoot;
		const query = searchQuery.trim();
		searchRequestRef.current += 1;
		const requestId = searchRequestRef.current;

		if (!root || !query) {
			setSearchedQuery('');
			setSearchResults([]);
			setSearchError(null);
			setSearchTruncated(false);
			setSearchLoading(false);
			return;
		}

		setSearchLoading(true);
		setSearchError(null);
		setSearchedQuery(query);
		setSearchResults([]);
		setSearchTruncated(false);

		try {
			const response = await searchFiles(root.path, query);
			if (searchRequestRef.current !== requestId) {
				return;
			}
			setSearchResults(response.matches);
			setSearchTruncated(response.truncated);
		} catch (cause) {
			if (searchRequestRef.current === requestId) {
				setSearchError(`Unable to search files: ${String(cause)}`);
			}
		} finally {
			if (searchRequestRef.current === requestId) {
				setSearchLoading(false);
			}
		}
	}, [activeRoot, searchQuery]);

	const openSearchResult = useCallback(
		async (result: FileSearchMatch) => {
			pendingFindQueryRef.current = searchedQuery || searchQuery.trim();
			await openFileAtPath(result.path, { mode: 'preview' });
		},
		[openFileAtPath, pendingFindQueryRef, searchQuery, searchedQuery]
	);

	const clearCrossFileSearch = useCallback(() => {
		searchRequestRef.current += 1;
		setSearchQuery('');
		setSearchedQuery('');
		setSearchResults([]);
		setSearchError(null);
		setSearchTruncated(false);
		setSearchLoading(false);
	}, []);

	return {
		searchQuery,
		setSearchQuery,
		searchedQuery,
		searchResults,
		searchLoading,
		searchError,
		searchTruncated,
		runCrossFileSearch,
		openSearchResult,
		clearCrossFileSearch,
	};
}
