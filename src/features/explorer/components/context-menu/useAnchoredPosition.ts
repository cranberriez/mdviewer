import { useLayoutEffect, useRef, useState } from 'react';
import type { DependencyList } from 'react';

const VIEWPORT_PADDING = 8;

export function useAnchoredPosition<T extends HTMLElement>(
	x: number,
	y: number,
	deps: DependencyList = []
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
			nextX = Math.max(VIEWPORT_PADDING, window.innerWidth - width - VIEWPORT_PADDING);
		}
		if (nextY + height + VIEWPORT_PADDING > window.innerHeight) {
			nextY = Math.max(VIEWPORT_PADDING, window.innerHeight - height - VIEWPORT_PADDING);
		}

		setPosition({ x: nextX, y: nextY });
		setReady(true);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [x, y, ...deps]);

	return { menuRef, position, ready };
}
