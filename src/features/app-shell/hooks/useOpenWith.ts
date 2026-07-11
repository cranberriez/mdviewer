import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { takePendingOpenPath } from '../../files/api/filesApi';

interface UseOpenWithOptions {
	sessionHydrated: boolean;
	openExternalPath: (path: string) => Promise<void>;
	onError: (message: string) => void;
}

export function useOpenWith({ sessionHydrated, openExternalPath, onError }: UseOpenWithOptions) {
	const openExternalPathRef = useRef(openExternalPath);
	const pendingPathRef = useRef<string | null>(null);
	openExternalPathRef.current = openExternalPath;

	useEffect(() => {
		if (!sessionHydrated) {
			return;
		}

		let disposed = false;
		let unlisten: (() => void) | undefined;

		async function consumePendingPath() {
			try {
				const path = pendingPathRef.current ?? (await takePendingOpenPath());
				pendingPathRef.current = path;
				if (path && !disposed) {
					await openExternalPathRef.current(path);
					pendingPathRef.current = null;
				}
			} catch (cause) {
				if (!disposed) {
					onError(`Unable to open requested item: ${String(cause)}`);
				}
			}
		}

		async function setup() {
			unlisten = await listen('open-path-requested', () => {
				void consumePendingPath();
			});
			await consumePendingPath();
		}

		void setup();

		return () => {
			disposed = true;
			unlisten?.();
		};
	}, [onError, sessionHydrated]);
}
