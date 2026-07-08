import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { parentPath } from '../../shared/utils/path';
import { startFileDrag } from '../files/api/filesApi';
import { deriveDropRenderHint } from './deriveDropRenderHint';
import { resolveDropZoneFromElement } from './dropZoneResolver';
import {
	EMPTY_INTERNAL_DRAG_STATE,
	type DragItem,
	type DropDispatcher,
	type DropMode,
	type DropZone,
	type InternalDragStart,
	type InternalDragState,
	resolveDropMode,
} from './dropTypes';

interface UseInternalDragOptions {
	activeRootPath: string | null;
	onDrop: DropDispatcher;
}

type PendingDrag = {
	items: DragItem[];
	startX: number;
	startY: number;
	pointerId: number;
	origin: EventTarget & Element;
	dragging: boolean;
	escalated: boolean;
};

const DRAG_THRESHOLD = 5;
const EXIT_TOLERANCE = 10;
const EXIT_GRACE_MS = 80;

function comparablePath(path: string) {
	return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function isSameLocationTarget(target: DropZone, items: DragItem[]) {
	if (target.kind !== 'tree-folder' && target.kind !== 'tree-root') {
		return false;
	}

	const dest = comparablePath(target.destDir);
	return items.some((item) => {
		const itemPath = comparablePath(item.path);
		return itemPath === dest || comparablePath(parentPath(item.path)) === dest;
	});
}

function isOutsideViewport(x: number, y: number, tolerance: number) {
	return (
		x < -tolerance ||
		y < -tolerance ||
		x > window.innerWidth + tolerance ||
		y > window.innerHeight + tolerance
	);
}

function isAtViewportExit(x: number, y: number) {
	return x <= 0 || y <= 0 || x >= window.innerWidth || y >= window.innerHeight;
}

function swallowNextClick() {
	const swallow = (click: MouseEvent) => {
		click.stopPropagation();
		click.preventDefault();
		window.removeEventListener('click', swallow, true);
	};
	window.addEventListener('click', swallow, true);
	window.setTimeout(() => window.removeEventListener('click', swallow, true), 500);
}

export function useInternalDrag({
	activeRootPath,
	onDrop,
}: UseInternalDragOptions): InternalDragController {
	const [state, setState] = useState<InternalDragState>(EMPTY_INTERNAL_DRAG_STATE);
	const pendingRef = useRef<PendingDrag | null>(null);
	const cleanupRef = useRef<(() => void) | null>(null);
	const activeRootPathRef = useRef(activeRootPath);
	const onDropRef = useRef(onDrop);
	const modeRef = useRef<DropMode>('move');

	activeRootPathRef.current = activeRootPath;
	onDropRef.current = onDrop;

	const clear = useCallback(() => {
		cleanupRef.current?.();
		cleanupRef.current = null;
		pendingRef.current = null;
		modeRef.current = 'move';
		document.body.style.removeProperty('cursor');
		setState(EMPTY_INTERNAL_DRAG_STATE);
	}, []);

	const updateActiveState = useCallback(
		(x: number, y: number, target: DropZone | null, items: DragItem[], mode: DropMode) => {
			setState({
				active: true,
				origin: 'internal',
				items,
				pointer: { x, y },
				target,
				mode,
				renderHint: target
					? deriveDropRenderHint({
							origin: 'internal',
							items,
							target,
							mode,
							activeRootPath: activeRootPathRef.current,
						})
					: null,
				activeRootPath: activeRootPathRef.current,
				escalatedToNative: false,
			});
		},
		[]
	);

	const targetAt = useCallback((x: number, y: number, items: DragItem[]) => {
		const target = resolveDropZoneFromElement(document.elementFromPoint(x, y), {
			activeRootPath: activeRootPathRef.current,
		});
		if (!target || isSameLocationTarget(target, items)) {
			return null;
		}
		return target;
	}, []);

	const escalateToNative = useCallback((current: PendingDrag) => {
		if (current.escalated) {
			return;
		}
		current.escalated = true;
		const paths = current.items.map((item) => item.path);
		const isFolder = current.items.some((item) => item.isDir);

		setState((existing) => ({
			...existing,
			active: false,
			target: null,
			renderHint: null,
			escalatedToNative: true,
		}));

		cleanupRef.current?.();
		cleanupRef.current = null;
		pendingRef.current = null;
		document.body.style.removeProperty('cursor');
		swallowNextClick();

		void startFileDrag(paths, { mode: 'copy', isFolder }).finally(() => {
			setState(EMPTY_INTERNAL_DRAG_STATE);
		});
	}, []);

	const beginInternalDrag = useCallback<InternalDragStart>(
		(items: DragItem[], event: ReactPointerEvent) => {
			if (items.length === 0 || event.button !== 0) {
				return;
			}

			cleanupRef.current?.();
			const origin = event.currentTarget;
			const pointerId = event.pointerId;
			let exitTimer: number | null = null;
			modeRef.current = resolveDropMode(event.shiftKey);
			pendingRef.current = {
				items,
				startX: event.clientX,
				startY: event.clientY,
				pointerId,
				origin,
				dragging: false,
				escalated: false,
			};

			function releaseOriginPointerCapture() {
				try {
					origin.releasePointerCapture?.(pointerId);
				} catch {
					// Capture can already be gone by the time this runs.
				}
			}

			function onGotPointerCapture(captureEvent: Event) {
				if (captureEvent instanceof PointerEvent && captureEvent.pointerId === pointerId) {
					releaseOriginPointerCapture();
				}
			}

			function cleanupListeners() {
				if (exitTimer != null) {
					window.clearTimeout(exitTimer);
					exitTimer = null;
				}
				window.removeEventListener('pointermove', onPointerMove);
				window.removeEventListener('pointerup', onPointerUp);
				window.removeEventListener('pointercancel', onPointerCancel);
				window.removeEventListener('keydown', onKey);
				window.removeEventListener('keyup', onKey);
				document.removeEventListener('pointerout', onPointerOut);
				document.removeEventListener('pointerover', onPointerOver);
				origin.removeEventListener('gotpointercapture', onGotPointerCapture);
				releaseOriginPointerCapture();
			}

			function promoteToDrag(move: PointerEvent) {
				const current = pendingRef.current;
				if (!current || current.dragging) {
					return current;
				}

				const dx = move.clientX - current.startX;
				const dy = move.clientY - current.startY;
				if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) {
					return null;
				}

				current.dragging = true;
				document.body.style.cursor = 'grabbing';
				return current;
			}

			function onPointerMove(move: PointerEvent) {
				const current = promoteToDrag(move);
				if (!current || current.escalated) {
					return;
				}

				modeRef.current = resolveDropMode(move.shiftKey);

				if (isOutsideViewport(move.clientX, move.clientY, EXIT_TOLERANCE)) {
					escalateToNative(current);
					return;
				}

				const target = targetAt(move.clientX, move.clientY, current.items);
				updateActiveState(move.clientX, move.clientY, target, current.items, modeRef.current);
			}

			function onPointerOut(out: PointerEvent) {
				const current = pendingRef.current;
				if (!current?.dragging || current.escalated || out.relatedTarget) {
					return;
				}
				if (isAtViewportExit(out.clientX, out.clientY) && exitTimer == null) {
					exitTimer = window.setTimeout(() => {
						exitTimer = null;
						const latest = pendingRef.current;
						if (latest?.dragging && !latest.escalated) {
							escalateToNative(latest);
						}
					}, EXIT_GRACE_MS);
				}
			}

			function onPointerOver() {
				if (exitTimer != null) {
					window.clearTimeout(exitTimer);
					exitTimer = null;
				}
			}

			function onPointerUp(up: PointerEvent) {
				const current = pendingRef.current;
				if (!current) {
					return;
				}

				const didDrag = current.dragging;
				if (current.dragging && !current.escalated) {
					const target = targetAt(up.clientX, up.clientY, current.items);
					onDropRef.current(target, current.items, resolveDropMode(up.shiftKey));
				}

				clear();
				if (didDrag) {
					swallowNextClick();
				}
			}

			function onPointerCancel() {
				clear();
			}

			function onKey(key: KeyboardEvent) {
				if (key.key === 'Escape') {
					const current = pendingRef.current;
					const didDrag = Boolean(current?.dragging);
					key.preventDefault();
					key.stopPropagation();
					clear();
					if (didDrag) {
						swallowNextClick();
					}
					return;
				}

				if (key.key !== 'Shift') {
					return;
				}
				const current = pendingRef.current;
				if (!current?.dragging || current.escalated) {
					modeRef.current = key.type === 'keydown' ? 'copy' : 'move';
					return;
				}

				modeRef.current = key.type === 'keydown' ? 'copy' : 'move';
				setState((existing) => {
					if (!existing.active || !existing.pointer) {
						return existing;
					}
					return {
						...existing,
						mode: modeRef.current,
						renderHint: existing.target
							? deriveDropRenderHint({
									origin: 'internal',
									items: existing.items,
									target: existing.target,
									mode: modeRef.current,
									activeRootPath: activeRootPathRef.current,
								})
							: null,
					};
				});
			}

			origin.addEventListener('gotpointercapture', onGotPointerCapture);
			releaseOriginPointerCapture();
			window.addEventListener('pointermove', onPointerMove);
			window.addEventListener('pointerup', onPointerUp);
			window.addEventListener('pointercancel', onPointerCancel);
			window.addEventListener('keydown', onKey);
			window.addEventListener('keyup', onKey);
			document.addEventListener('pointerout', onPointerOut);
			document.addEventListener('pointerover', onPointerOver);
			cleanupRef.current = cleanupListeners;
		},
		[clear, escalateToNative, targetAt, updateActiveState]
	);

	useEffect(() => () => clear(), [clear]);

	return { state, beginInternalDrag };
}

export interface InternalDragController {
	state: InternalDragState;
	beginInternalDrag: InternalDragStart;
}
