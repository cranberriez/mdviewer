import { useCallback, useEffect, useRef, useState } from 'react';
import type { FileViewMode } from '../../file-actions/components/FileActionControls';

interface FindAfterOpenControls {
	close: () => void;
	openWithQuery: (query: string) => void;
}

interface UseFindAfterOpenOptions {
	find: FindAfterOpenControls;
	mode: FileViewMode;
	openFilePath: string | null;
	renderedMarkdown: string;
}

export function useFindAfterOpen({
	find,
	mode,
	openFilePath,
	renderedMarkdown,
}: UseFindAfterOpenOptions) {
	const [pendingFindQuery, setPendingFindQuery] = useState<string | null>(null);
	const previousOpenFilePathRef = useRef(openFilePath);

	useEffect(() => {
		if (previousOpenFilePathRef.current === openFilePath) {
			return;
		}

		previousOpenFilePathRef.current = openFilePath;
		find.close();
	}, [find, openFilePath]);

	useEffect(() => {
		if (!pendingFindQuery || mode !== 'preview') {
			return;
		}

		const frame = window.requestAnimationFrame(() => {
			find.openWithQuery(pendingFindQuery);
			setPendingFindQuery(null);
		});

		return () => window.cancelAnimationFrame(frame);
	}, [find, mode, openFilePath, pendingFindQuery, renderedMarkdown]);

	const queueFindQueryAfterOpen = useCallback((query: string) => {
		setPendingFindQuery(query);
	}, []);

	return { queueFindQueryAfterOpen };
}
