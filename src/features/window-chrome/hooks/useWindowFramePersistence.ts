import { useEffect, useState } from 'react';
import { getCurrentWindow, PhysicalPosition, PhysicalSize } from '@tauri-apps/api/window';
import { confirm as confirmDialog } from '@tauri-apps/plugin-dialog';
import {
	saveAppConfiguration,
	type AppConfigurationState,
	type StoredWindowFrame,
} from '../../../shared/state/persistence';

interface MutableRef<T> {
	current: T;
}

interface UseWindowFramePersistenceOptions {
	initialFrame?: StoredWindowFrame;
	configurationRef: MutableRef<AppConfigurationState>;
	unsavedFileDraftsRef: MutableRef<Record<string, unknown>>;
	onFrameChange: (frame: StoredWindowFrame) => void;
}

export function useWindowFramePersistence({
	initialFrame,
	configurationRef,
	unsavedFileDraftsRef,
	onFrameChange,
}: UseWindowFramePersistenceOptions) {
	const [isMaximized, setIsMaximized] = useState(false);

	useEffect(() => {
		const appWindow = getCurrentWindow();
		let cancelled = false;
		let unlistenResize: (() => void) | undefined;

		async function setup() {
			try {
				const maximized = await appWindow.isMaximized();
				if (!cancelled) setIsMaximized(maximized);

				const unlisten = await appWindow.onResized(async () => {
					const v = await appWindow.isMaximized();
					if (!cancelled) setIsMaximized(v);
				});

				if (cancelled) {
					unlisten();
				} else {
					unlistenResize = unlisten;
				}
			} catch {
				// Best effort; window APIs may not be available outside Tauri.
			}
		}

		void setup();

		return () => {
			cancelled = true;
			unlistenResize?.();
		};
	}, []);

	useEffect(() => {
		const appWindow = getCurrentWindow();
		const unlisteners: Array<() => void> = [];
		let cancelled = false;

		async function captureWindowFrame() {
			try {
				const [size, position, maximized] = await Promise.all([
					appWindow.innerSize(),
					appWindow.outerPosition(),
					appWindow.isMaximized(),
				]);

				const nextFrame: StoredWindowFrame = {
					width: size.width,
					height: size.height,
					x: position.x,
					y: position.y,
					maximized,
				};

				if (cancelled) {
					return;
				}

				onFrameChange(nextFrame);

				const nextConfiguration = {
					...configurationRef.current,
					windowFrame: nextFrame,
				};
				configurationRef.current = nextConfiguration;
				saveAppConfiguration(nextConfiguration);
			} catch {
				// Window persistence is best effort outside the Tauri runtime.
			}
		}

		async function restoreWindowFrame() {
			if (!initialFrame) {
				return;
			}

			try {
				if (initialFrame.maximized) {
					await appWindow.setPosition(new PhysicalPosition(initialFrame.x, initialFrame.y));
					await appWindow.setSize(new PhysicalSize(initialFrame.width, initialFrame.height));
					await appWindow.maximize();
					return;
				}

				await appWindow.setPosition(new PhysicalPosition(initialFrame.x, initialFrame.y));
				await appWindow.setSize(new PhysicalSize(initialFrame.width, initialFrame.height));
			} catch {
				// Ignore stale monitor positions or unavailable window APIs.
			}
		}

		void restoreWindowFrame();

		void appWindow
			.onResized(() => void captureWindowFrame())
			.then((unlisten) => {
				if (cancelled) {
					unlisten();
				} else {
					unlisteners.push(unlisten);
				}
			})
			.catch(() => undefined);

		void appWindow
			.onMoved(() => void captureWindowFrame())
			.then((unlisten) => {
				if (cancelled) {
					unlisten();
				} else {
					unlisteners.push(unlisten);
				}
			})
			.catch(() => undefined);

		void appWindow
			.onCloseRequested(async (event) => {
				await captureWindowFrame();

				const draftCount = Object.keys(unsavedFileDraftsRef.current).length;
				if (draftCount === 0) {
					return;
				}

				const confirmed = await confirmDialog(
					draftCount === 1
						? 'There are unsaved changes in 1 file. Close without saving?'
						: `There are unsaved changes in ${draftCount} files. Close without saving?`,
					{
						title: 'Unsaved Changes',
						kind: 'warning',
						okLabel: 'Close Without Saving',
						cancelLabel: 'Cancel',
					}
				);

				if (!confirmed) {
					event.preventDefault();
				}
			})
			.then((unlisten) => {
				if (cancelled) {
					unlisten();
				} else {
					unlisteners.push(unlisten);
				}
			})
			.catch(() => undefined);

		return () => {
			cancelled = true;
			unlisteners.forEach((unlisten) => unlisten());
		};
	}, [configurationRef, initialFrame, onFrameChange, unsavedFileDraftsRef]);

	return { isMaximized };
}
