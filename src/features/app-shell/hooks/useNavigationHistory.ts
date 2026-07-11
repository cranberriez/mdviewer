import { useCallback, useEffect, useRef, useState } from 'react';
import type { Entry } from '../../../shared/types/files';
import { comparablePath } from '../../../shared/utils/path';

export type NavigationDestination =
	| { kind: 'home' }
	| {
			kind: 'workspace';
			root: Entry | null;
			filePath: string | null;
	  };

interface UseNavigationHistoryOptions {
	enabled: boolean;
	getCurrentDestination: () => NavigationDestination | null;
	onNavigate: (destination: NavigationDestination) => Promise<void>;
}

function samePath(left?: string | null, right?: string | null) {
	if (!left || !right) {
		return left === right;
	}
	return comparablePath(left) === comparablePath(right);
}

function sameDestination(left: NavigationDestination, right: NavigationDestination) {
	if (left.kind !== right.kind) {
		return false;
	}
	if (left.kind === 'home' || right.kind === 'home') {
		return true;
	}
	return samePath(left.root?.path, right.root?.path) && samePath(left.filePath, right.filePath);
}

export function useNavigationHistory({
	enabled,
	getCurrentDestination,
	onNavigate,
}: UseNavigationHistoryOptions) {
	const entriesRef = useRef<NavigationDestination[]>([]);
	const indexRef = useRef(-1);
	const navigatingRef = useRef(false);
	const [state, setState] = useState({ canGoBack: false, canGoForward: false, navigating: false });

	const publishState = useCallback(() => {
		setState({
			canGoBack: indexRef.current > 0,
			canGoForward: indexRef.current >= 0 && indexRef.current < entriesRef.current.length - 1,
			navigating: navigatingRef.current,
		});
	}, []);

	const initialize = useCallback(
		(destinations: NavigationDestination[]) => {
			if (entriesRef.current.length > 0) {
				return;
			}
			const unique = destinations.filter(
				(destination, index) =>
					index === 0 || !sameDestination(destinations[index - 1], destination)
			);
			entriesRef.current = unique;
			indexRef.current = unique.length - 1;
			publishState();
		},
		[publishState]
	);

	const performNavigation = useCallback(
		async (action: () => void | Promise<void>) => {
			const before = getCurrentDestination();
			await action();
			const after = getCurrentDestination();
			if (!before || !after || sameDestination(before, after)) {
				return;
			}

			let entries = entriesRef.current;
			let index = indexRef.current;
			if (index < 0) {
				entries = [before];
				index = 0;
			} else if (!sameDestination(entries[index], before)) {
				entries = [...entries.slice(0, index + 1), before];
				index += 1;
			}

			entriesRef.current = [...entries.slice(0, index + 1), after];
			indexRef.current = index + 1;
			publishState();
		},
		[getCurrentDestination, publishState]
	);

	const move = useCallback(
		async (offset: -1 | 1) => {
			if (navigatingRef.current) {
				return;
			}
			const nextIndex = indexRef.current + offset;
			const destination = entriesRef.current[nextIndex];
			if (!destination) {
				return;
			}

			navigatingRef.current = true;
			publishState();
			try {
				await onNavigate(destination);
				const actual = getCurrentDestination();
				if (actual) {
					entriesRef.current[nextIndex] = actual;
					indexRef.current = nextIndex;
				}
			} finally {
				navigatingRef.current = false;
				publishState();
			}
		},
		[getCurrentDestination, onNavigate, publishState]
	);

	const goBack = useCallback(() => move(-1), [move]);
	const goForward = useCallback(() => move(1), [move]);

	useEffect(() => {
		if (!enabled) {
			return;
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.defaultPrevented) {
				return;
			}
			const back =
				event.key === 'BrowserBack' ||
				(event.altKey && !event.ctrlKey && !event.metaKey && event.key === 'ArrowLeft') ||
				(event.metaKey && !event.ctrlKey && event.key === '[');
			const forward =
				event.key === 'BrowserForward' ||
				(event.altKey && !event.ctrlKey && !event.metaKey && event.key === 'ArrowRight') ||
				(event.metaKey && !event.ctrlKey && event.key === ']');
			if (!back && !forward) {
				return;
			}
			event.preventDefault();
			void (back ? goBack() : goForward());
		}

		function handleMouseDown(event: MouseEvent) {
			if (event.defaultPrevented) {
				return;
			}
			if (event.button !== 3 && event.button !== 4) {
				return;
			}
			event.preventDefault();
			void (event.button === 3 ? goBack() : goForward());
		}

		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('mousedown', handleMouseDown);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('mousedown', handleMouseDown);
		};
	}, [enabled, goBack, goForward]);

	return {
		...state,
		goBack,
		goForward,
		initialize,
		performNavigation,
	};
}
