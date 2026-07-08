import { useCallback, useEffect, useRef, useState } from 'react';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { fileExtension, fileName, isVisibleFileName } from '../../shared/utils/path';
import { shiftPressed } from '../files/api/filesApi';
import { deriveDropRenderHint } from './deriveDropRenderHint';
import { resolveDropZoneFromElement } from './dropZoneResolver';
import {
	EMPTY_EXTERNAL_DROP_STATE,
	type DragItem,
	type DropDispatcher,
	type DropMode,
	type DropZone,
	type ExternalDropState,
	resolveDropMode,
} from './dropTypes';

export interface FileDropCallbacks {
	activeRootPath: string | null;
	onDrop: DropDispatcher;
}

function pathsToExternalItems(paths: string[]): DragItem[] {
	return paths.map((path) => {
		const name = fileName(path);
		return {
			path,
			name,
			isDir: !isVisibleFileName(path) && fileExtension(path) === '',
		};
	});
}

/**
 * Handles native OS file drops into the app. App-origin drags are intentionally
 * handled by useInternalDrag so React owns all in-window hover feedback.
 */
export function useFileDrop({ activeRootPath, onDrop }: FileDropCallbacks): FileDropController {
	const [state, setState] = useState<ExternalDropState>(EMPTY_EXTERNAL_DROP_STATE);
	const shiftRef = useRef(false);
	const pathsRef = useRef<string[]>([]);

	const callbacksRef = useRef<FileDropCallbacks>({ activeRootPath, onDrop });
	callbacksRef.current = { activeRootPath, onDrop };

	const applyHover = useCallback((x: number, y: number, paths: string[]) => {
		const items = pathsToExternalItems(paths);
		const element = document.elementFromPoint(x, y);
		const target = resolveDropZoneFromElement(element, {
			activeRootPath: callbacksRef.current.activeRootPath,
		});
		const mode = resolveDropMode(shiftRef.current);

		setState({
			active: true,
			origin: 'external',
			items,
			pointer: { x, y },
			target,
			mode,
			renderHint: target
				? deriveDropRenderHint({
						origin: 'external',
						items,
						target,
						mode,
						activeRootPath: callbacksRef.current.activeRootPath,
					})
				: null,
			activeRootPath: callbacksRef.current.activeRootPath,
			escalatedToNative: false,
		});
	}, []);

	const updateFromPosition = useCallback(
		(physicalX: number, physicalY: number, paths: string[]) => {
			const ratio = window.devicePixelRatio || 1;
			applyHover(physicalX / ratio, physicalY / ratio, paths);
		},
		[applyHover]
	);

	function resolveDropZoneAtPosition(physicalX: number, physicalY: number): DropZone | null {
		const ratio = window.devicePixelRatio || 1;
		const element = document.elementFromPoint(physicalX / ratio, physicalY / ratio);
		return resolveDropZoneFromElement(element, {
			activeRootPath: callbacksRef.current.activeRootPath,
		});
	}

	const dispatchExternalDrop = useCallback(
		(target: DropZone | null, paths: string[], mode: DropMode) => {
			callbacksRef.current.onDrop(target, pathsToExternalItems(paths), mode);
		},
		[]
	);

	useEffect(() => {
		let disposed = false;
		let unlisten: (() => void) | undefined;

		function refreshMode() {
			setState((current) => {
				if (!current.active) {
					return current;
				}
				const mode = resolveDropMode(shiftRef.current);
				return {
					...current,
					mode,
					renderHint: current.target
						? deriveDropRenderHint({
								origin: 'external',
								items: current.items,
								target: current.target,
								mode,
								activeRootPath: callbacksRef.current.activeRootPath,
							})
						: null,
				};
			});
		}

		function onKey(event: KeyboardEvent) {
			if (event.key === 'Shift') {
				shiftRef.current = event.type === 'keydown';
				refreshMode();
			}
		}

		function pollShiftFromOs() {
			void shiftPressed()
				.then((held) => {
					if (disposed || held === shiftRef.current) {
						return;
					}
					shiftRef.current = held;
					refreshMode();
				})
				.catch(() => undefined);
		}

		window.addEventListener('keydown', onKey);
		window.addEventListener('keyup', onKey);

		void getCurrentWebview()
			.onDragDropEvent((event) => {
				if (disposed) {
					return;
				}

				const payload = event.payload;

				if (payload.type === 'enter' || payload.type === 'over') {
					if ('paths' in payload && Array.isArray(payload.paths) && payload.paths.length > 0) {
						pathsRef.current = payload.paths;
					}
					pollShiftFromOs();
					updateFromPosition(payload.position.x, payload.position.y, pathsRef.current);
					return;
				}

				if (payload.type === 'leave') {
					pathsRef.current = [];
					setState(EMPTY_EXTERNAL_DROP_STATE);
					return;
				}

				if (payload.type === 'drop') {
					const paths =
						'paths' in payload && Array.isArray(payload.paths) && payload.paths.length > 0
							? payload.paths
							: pathsRef.current;
					const target = resolveDropZoneAtPosition(payload.position.x, payload.position.y);
					dispatchExternalDrop(target, paths, resolveDropMode(shiftRef.current));

					pathsRef.current = [];
					setState(EMPTY_EXTERNAL_DROP_STATE);
				}
			})
			.then((dispose) => {
				if (disposed) {
					dispose();
				} else {
					unlisten = dispose;
				}
			})
			.catch(() => {
				// Native drag-drop events are only available inside the Tauri runtime.
			});

		return () => {
			disposed = true;
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('keyup', onKey);
			unlisten?.();
		};
	}, [dispatchExternalDrop, updateFromPosition]);

	return { state };
}

export interface FileDropController {
	state: ExternalDropState;
}
