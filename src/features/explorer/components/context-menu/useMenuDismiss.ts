import { useEffect } from 'react';
import type { RefObject } from 'react';

export function useMenuDismiss<T extends HTMLElement>(
	menuRef: RefObject<T | null>,
	onClose: () => void
) {
	useEffect(() => {
		function handlePointerDown(event: MouseEvent) {
			if (!menuRef.current?.contains(event.target as Node)) {
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
	}, [menuRef, onClose]);
}
