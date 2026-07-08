import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	type RefObject,
	type UIEvent,
} from 'react';
import type { FileViewMode } from '../../file-actions/components/FileActionControls';
import type { OpenFile } from '../../../shared/types/files';

type ScrollPanel = 'editor' | 'preview';

interface ScrollSnapshot {
	scrollTop: number;
	topRatio: number;
	centerRatio: number;
	clientHeight: number;
	scrollHeight: number;
}

interface UseScrollSyncOptions {
	editorScrollRef: RefObject<HTMLTextAreaElement | null>;
	mode: FileViewMode;
	openFile: OpenFile | null;
	renderedMarkdown: string;
	visualEditorRootRef: RefObject<HTMLDivElement | null>;
}

export function clampScrollTop(scrollTop: number, element: HTMLElement) {
	return Math.max(0, Math.min(element.scrollHeight - element.clientHeight, scrollTop));
}

export function scrollCenterRatio(element: HTMLElement) {
	if (element.scrollHeight <= element.clientHeight) {
		return 0;
	}

	return Math.max(
		0,
		Math.min(1, (element.scrollTop + element.clientHeight / 2) / element.scrollHeight)
	);
}

function scrollTopRatio(element: HTMLElement) {
	if (element.scrollHeight <= element.clientHeight) {
		return 0;
	}

	return Math.max(0, Math.min(1, element.scrollTop / element.scrollHeight));
}

export function useScrollSync({
	editorScrollRef,
	mode,
	openFile,
	renderedMarkdown,
	visualEditorRootRef,
}: UseScrollSyncOptions) {
	const previewScrollRef = useRef<HTMLElement | null>(null);
	const topRatioRef = useRef(0);
	const centerRatioRef = useRef(0);
	const ignoredScrollPanelsRef = useRef<Set<ScrollPanel>>(new Set());
	const lastScrolledPanelRef = useRef<ScrollPanel>('preview');
	const scrollSnapshotsRef = useRef<Record<string, ScrollSnapshot>>({});
	const sharedFileTopRatioRef = useRef<Record<string, number>>({});
	const sharedFileRatioRef = useRef<Record<string, number>>({});

	const filePositionKey = openFile?.path ?? '';

	const setPreviewScrollRef = useCallback((node: HTMLElement | null) => {
		previewScrollRef.current = node;
	}, []);

	const scrollSnapshotKey = useCallback(
		(panel: ScrollPanel) => `${filePositionKey}:${mode}:${panel}`,
		[filePositionKey, mode]
	);

	const getPanelElement = useCallback(
		(panel: ScrollPanel): HTMLElement | null => {
			if (panel === 'editor') {
				return editorScrollRef.current;
			}

			if (mode === 'edit' && openFile?.kind === 'md') {
				return visualEditorRootRef.current;
			}

			return previewScrollRef.current;
		},
		[editorScrollRef, mode, openFile?.kind, visualEditorRootRef]
	);

	const rememberScrollSnapshot = useCallback(
		(panel: ScrollPanel, element: HTMLElement) => {
			if (!openFile) {
				return;
			}

			const topRatio = scrollTopRatio(element);
			const centerRatio = scrollCenterRatio(element);
			topRatioRef.current = topRatio;
			centerRatioRef.current = centerRatio;
			sharedFileTopRatioRef.current[filePositionKey] = topRatio;
			sharedFileRatioRef.current[filePositionKey] = centerRatio;
			scrollSnapshotsRef.current[scrollSnapshotKey(panel)] = {
				scrollTop: element.scrollTop,
				topRatio,
				centerRatio,
				clientHeight: element.clientHeight,
				scrollHeight: element.scrollHeight,
			};
		},
		[filePositionKey, openFile, scrollSnapshotKey]
	);

	const activeScrollPanels = useCallback((): ScrollPanel[] => {
		if (!openFile) {
			return [];
		}

		if (mode === 'code') {
			return ['editor', 'preview'];
		}

		if (mode === 'edit' && openFile.kind !== 'md') {
			return ['editor'];
		}

		return ['preview'];
	}, [mode, openFile]);

	const restoreScrollSnapshots = useCallback(() => {
		if (!openFile) {
			return;
		}

		for (const panel of activeScrollPanels()) {
			const element = getPanelElement(panel);
			if (!element || element.clientHeight === 0 || element.scrollHeight === 0) {
				continue;
			}

			const snapshot = scrollSnapshotsRef.current[scrollSnapshotKey(panel)];
			const restoreRatio =
				sharedFileTopRatioRef.current[filePositionKey] ?? snapshot?.topRatio ?? 0;
			const nextScrollTop = clampScrollTop(restoreRatio * element.scrollHeight, element);

			if (Math.abs(element.scrollTop - nextScrollTop) < 1) {
				continue;
			}

			ignoredScrollPanelsRef.current.add(panel);
			element.scrollTop = nextScrollTop;
		}

		window.requestAnimationFrame(() => {
			ignoredScrollPanelsRef.current.clear();
		});
	}, [activeScrollPanels, filePositionKey, getPanelElement, openFile, scrollSnapshotKey]);

	const applyCenterRatio = useCallback(
		(panel: ScrollPanel, ratio: number) => {
			const element = getPanelElement(panel);

			if (!element || element.clientHeight === 0 || element.scrollHeight === 0) {
				return;
			}

			const nextScrollTop = clampScrollTop(
				ratio * element.scrollHeight - element.clientHeight / 2,
				element
			);

			if (Math.abs(element.scrollTop - nextScrollTop) < 1) {
				return;
			}

			ignoredScrollPanelsRef.current.add(panel);
			element.scrollTop = nextScrollTop;

			window.requestAnimationFrame(() => {
				ignoredScrollPanelsRef.current.delete(panel);
			});
		},
		[getPanelElement]
	);

	const applyTopRatio = useCallback(
		(panel: ScrollPanel, ratio: number) => {
			const element = getPanelElement(panel);

			if (!element || element.clientHeight === 0 || element.scrollHeight === 0) {
				return;
			}

			const nextScrollTop = clampScrollTop(ratio * element.scrollHeight, element);

			if (Math.abs(element.scrollTop - nextScrollTop) < 1) {
				return;
			}

			ignoredScrollPanelsRef.current.add(panel);
			element.scrollTop = nextScrollTop;

			window.requestAnimationFrame(() => {
				ignoredScrollPanelsRef.current.delete(panel);
			});
		},
		[getPanelElement]
	);

	const syncFromPanel = useCallback(
		(panel: ScrollPanel, element: HTMLElement) => {
			if (ignoredScrollPanelsRef.current.has(panel)) {
				ignoredScrollPanelsRef.current.delete(panel);
				return;
			}

			const ratio = scrollCenterRatio(element);
			rememberScrollSnapshot(panel, element);
			topRatioRef.current = scrollTopRatio(element);
			centerRatioRef.current = ratio;
			lastScrolledPanelRef.current = panel;
			if (mode === 'code') {
				applyCenterRatio(panel === 'editor' ? 'preview' : 'editor', ratio);
			}
		},
		[applyCenterRatio, mode, rememberScrollSnapshot]
	);

	const handleEditorScroll = useCallback(
		(event: UIEvent<HTMLTextAreaElement>) => {
			syncFromPanel('editor', event.currentTarget);
		},
		[syncFromPanel]
	);

	const handlePreviewScroll = useCallback(
		(event: UIEvent<HTMLElement>) => {
			syncFromPanel('preview', event.currentTarget);
		},
		[syncFromPanel]
	);

	const rememberEditorScrollPosition = useCallback(() => {
		const editor = editorScrollRef.current;
		if (!editor) {
			return;
		}

		rememberScrollSnapshot('editor', editor);
		topRatioRef.current = scrollTopRatio(editor);
		centerRatioRef.current = scrollCenterRatio(editor);
		lastScrolledPanelRef.current = 'editor';
	}, [editorScrollRef, rememberScrollSnapshot]);

	useEffect(() => {
		topRatioRef.current = openFile ? (sharedFileTopRatioRef.current[filePositionKey] ?? 0) : 0;
		centerRatioRef.current = openFile ? (sharedFileRatioRef.current[filePositionKey] ?? 0) : 0;
		ignoredScrollPanelsRef.current.clear();
		lastScrolledPanelRef.current = 'preview';
	}, [filePositionKey, openFile]);

	useLayoutEffect(() => {
		if (!openFile) {
			return;
		}

		restoreScrollSnapshots();
		const frame = window.requestAnimationFrame(restoreScrollSnapshots);

		return () => window.cancelAnimationFrame(frame);
	}, [mode, openFile?.path, renderedMarkdown, restoreScrollSnapshots]);

	useEffect(() => {
		if (!openFile || mode === 'preview') {
			return;
		}

		const target = lastScrolledPanelRef.current === 'editor' ? 'preview' : 'editor';
		const frame = window.requestAnimationFrame(() => {
			if (mode === 'code') {
				applyTopRatio(target, topRatioRef.current);
			}
		});

		return () => window.cancelAnimationFrame(frame);
	}, [applyTopRatio, mode, openFile?.content, openFile?.path, renderedMarkdown]);

	return {
		handleEditorScroll,
		handlePreviewScroll,
		previewScrollRef,
		rememberEditorScrollPosition,
		setPreviewScrollRef,
	};
}
