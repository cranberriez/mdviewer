import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { openPath, openUrl } from '@tauri-apps/plugin-opener';
import type { FileViewMode } from '../../file-actions/components/FileActionControls';
import { resolveLinkPath } from '../../files/api/filesApi';
import { comparablePath, isVisibleFileName } from '../../../shared/utils/path';
import { slugify } from '../slug';

interface UsePreviewNavigationOptions {
	findTargetRef: RefObject<HTMLElement | null>;
	mode: FileViewMode;
	openFilePath: string | null;
	renderedMarkdown: string;
	openFileAtPath: (path: string) => Promise<void>;
	onError: (message: string) => void;
}

export function usePreviewNavigation({
	findTargetRef,
	mode,
	openFilePath,
	renderedMarkdown,
	openFileAtPath,
	onError,
}: UsePreviewNavigationOptions) {
	const pendingAnchorRef = useRef<string | null>(null);

	const scrollToAnchor = useCallback(
		(fragment: string) => {
			const scope = findTargetRef.current;
			if (!scope || !fragment) {
				return false;
			}

			for (const candidate of [fragment, slugify(fragment)]) {
				if (!candidate) {
					continue;
				}
				const node = scope.querySelector(
					`#${CSS.escape(candidate)}, [name="${CSS.escape(candidate)}"]`
				);
				if (node) {
					node.scrollIntoView({ behavior: 'smooth', block: 'start' });
					return true;
				}
			}

			return false;
		},
		[findTargetRef]
	);

	useEffect(() => {
		const fragment = pendingAnchorRef.current;
		if (!fragment) {
			return;
		}

		const frame = window.requestAnimationFrame(() => {
			scrollToAnchor(fragment);
			pendingAnchorRef.current = null;
		});

		return () => window.cancelAnimationFrame(frame);
	}, [openFilePath, renderedMarkdown, mode, scrollToAnchor]);

	const handleLinkClick = useCallback(
		async (href: string) => {
			const target = href.trim();
			if (!target) {
				return;
			}

			if (target.startsWith('#')) {
				scrollToAnchor(decodeURIComponent(target.slice(1)));
				return;
			}

			if (/^[a-z][a-z0-9+.-]*:/i.test(target) && !/^[a-z]:[\\/]/i.test(target)) {
				try {
					await openUrl(target);
				} catch (cause) {
					onError(`Unable to open link: ${String(cause)}`);
				}
				return;
			}

			if (!openFilePath) {
				return;
			}

			const hashIndex = target.indexOf('#');
			const pathPart = hashIndex >= 0 ? target.slice(0, hashIndex) : target;
			const fragment = hashIndex >= 0 ? decodeURIComponent(target.slice(hashIndex + 1)) : '';
			const [cleanPath] = pathPart.split('?');

			try {
				const resolved = await resolveLinkPath(openFilePath, decodeURIComponent(cleanPath));

				if (isVisibleFileName(resolved)) {
					if (fragment && comparablePath(resolved) === comparablePath(openFilePath)) {
						scrollToAnchor(fragment);
					} else {
						pendingAnchorRef.current = fragment || null;
						await openFileAtPath(resolved);
					}
				} else {
					await openPath(resolved);
				}
			} catch (cause) {
				onError(`Unable to open link: ${String(cause)}`);
			}
		},
		[onError, openFileAtPath, openFilePath, scrollToAnchor]
	);

	return { scrollToAnchor, handleLinkClick };
}
