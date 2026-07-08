import type { MouseEvent as ReactMouseEvent } from 'react';

export interface PositionedMenu {
	x: number;
	y: number;
}

interface AnchorOptions {
	offsetX?: number;
	offsetY?: number;
}

export function positionMenuFromElement(
	element: Element,
	{ offsetX = 0, offsetY = 0 }: AnchorOptions = {}
): PositionedMenu {
	const rect = element.getBoundingClientRect();
	return {
		x: rect.left + offsetX,
		y: rect.bottom + offsetY,
	};
}

export function openAnchoredContextMenu(
	event: ReactMouseEvent,
	openMenu: (position: PositionedMenu) => void,
	options?: AnchorOptions
) {
	event.preventDefault();
	event.stopPropagation();
	openMenu(positionMenuFromElement(event.currentTarget, options));
}
