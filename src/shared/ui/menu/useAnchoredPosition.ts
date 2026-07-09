import { useLayoutEffect, useRef, useState } from 'react';
import type { DependencyList } from 'react';

const VIEWPORT_PADDING = 8;

export interface AnchoredPositionOptions {
	fallbackX?: (width: number) => number;
	fallbackY?: (height: number) => number;
}

export function useAnchoredPosition<T extends HTMLElement>(
	x: number,
	y: number,
	deps: DependencyList = [],
	options: AnchoredPositionOptions = {}
) {
	const menuRef = useRef<T | null>(null);
	const [position, setPosition] = useState({ x, y });
	const [ready, setReady] = useState(false);

	useLayoutEffect(() => {
		const menu = menuRef.current;
		if (!menu) {
			return;
		}

		const { offsetWidth: width, offsetHeight: height } = menu;
		let nextX = x;
		let nextY = y;

		if (nextX + width + VIEWPORT_PADDING > window.innerWidth) {
			const fallbackX = options.fallbackX?.(width);
			nextX =
				fallbackX === undefined
					? Math.max(VIEWPORT_PADDING, window.innerWidth - width - VIEWPORT_PADDING)
					: Math.max(VIEWPORT_PADDING, fallbackX);
		}
		if (nextY + height + VIEWPORT_PADDING > window.innerHeight) {
			const fallbackY = options.fallbackY?.(height);
			nextY =
				fallbackY === undefined
					? Math.max(VIEWPORT_PADDING, window.innerHeight - height - VIEWPORT_PADDING)
					: Math.max(VIEWPORT_PADDING, fallbackY);
		}

		setPosition({ x: nextX, y: nextY });
		setReady(true);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [x, y, options.fallbackX, options.fallbackY, ...deps]);

	return { menuRef, position, ready };
}
