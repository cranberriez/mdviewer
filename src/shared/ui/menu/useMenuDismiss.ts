import { useEffect } from 'react';
import type { RefObject } from 'react';

interface UseMenuDismissOptions {
	enabled?: boolean;
	ignoreRefs?: RefObject<Element | null>[];
	ignoreSelector?: string;
}

export function useMenuDismiss<T extends HTMLElement>(
	menuRef: RefObject<T | null>,
	onClose: () => void,
	options: UseMenuDismissOptions = {}
) {
	useEffect(() => {
		if (options.enabled === false) {
			return;
		}

		function isIgnoredTarget(target: Node) {
			if (menuRef.current?.contains(target)) {
				return true;
			}
			if (options.ignoreRefs?.some((ref) => ref.current?.contains(target))) {
				return true;
			}
			return Boolean(
				options.ignoreSelector &&
					target instanceof HTMLElement &&
					target.closest(options.ignoreSelector)
			);
		}

		function handlePointerDown(event: MouseEvent) {
			if (!isIgnoredTarget(event.target as Node)) {
				onClose();
			}
		}
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				onClose();
			}
		}

		window.addEventListener('mousedown', handlePointerDown);
		window.addEventListener('contextmenu', handlePointerDown);
		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('blur', onClose);
		window.addEventListener('resize', onClose);

		return () => {
			window.removeEventListener('mousedown', handlePointerDown);
			window.removeEventListener('contextmenu', handlePointerDown);
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('blur', onClose);
			window.removeEventListener('resize', onClose);
		};
	}, [menuRef, onClose, options.enabled, options.ignoreRefs, options.ignoreSelector]);
}
