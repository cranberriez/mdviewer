import { useCallback, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

export const DEFAULT_SIDEBAR_WIDTH = 280;
export const MIN_SIDEBAR_WIDTH = 240;
export const MAX_SIDEBAR_WIDTH = 420;
export const MIN_CONTENT_WIDTH = 420;

export function clampSidebarWidth(width: number) {
	const availableMax = Math.max(
		MIN_SIDEBAR_WIDTH,
		Math.min(MAX_SIDEBAR_WIDTH, window.innerWidth - MIN_CONTENT_WIDTH)
	);

	return Math.min(availableMax, Math.max(MIN_SIDEBAR_WIDTH, width));
}

export function useSidebarResize(initialWidth?: number) {
	const [sidebarWidth, setSidebarWidth] = useState(() =>
		clampSidebarWidth(initialWidth ?? DEFAULT_SIDEBAR_WIDTH)
	);

	const startSidebarResize = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			event.preventDefault();

			const startX = event.clientX;
			const startWidth = sidebarWidth;

			function resize(moveEvent: PointerEvent) {
				setSidebarWidth(clampSidebarWidth(startWidth + moveEvent.clientX - startX));
			}

			function stopResize() {
				window.removeEventListener('pointermove', resize);
				window.removeEventListener('pointerup', stopResize);
			}

			window.addEventListener('pointermove', resize);
			window.addEventListener('pointerup', stopResize);
		},
		[sidebarWidth]
	);

	return { sidebarWidth, startSidebarResize };
}
