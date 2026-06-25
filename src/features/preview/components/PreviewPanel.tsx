import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type KeyboardEvent,
	type ReactNode,
	type RefObject,
	type UIEvent,
} from 'react';
import type { FileViewMode } from '../../file-actions/components/FileActionControls';
import type { OpenFile } from '../../../shared/types/files';
import { parentPath } from '../../../shared/utils/path';
import { Notice } from '../../../shared/ui/components/Notice';
import { applyMarkdownAction, type MarkdownAction } from '../markdownActions';
import { EmptyPreview } from './EmptyPreview';
import { MarkdownPreview } from './MarkdownPreview';
import { PlainTextPreview } from './PlainTextPreview';
import { LexicalMarkdownEditor, type LexicalMarkdownEditorHandle } from './LexicalMarkdownEditor';

interface PreviewPanelProps {
	/** Floating outline overlay, rendered into the content area's left gutter. */
	outlinePanel: ReactNode;
	/** Drag-and-drop overlay shown over the whole content area while dragging. */
	dropOverlay: ReactNode;
	actionBar: ReactNode;
	error: string | null;
	findBar: ReactNode;
	findTargetRef: RefObject<HTMLElement | null>;
	mode: FileViewMode;
	openFile: OpenFile | null;
	onContentChange: (content: string) => void;
	onLinkClick: (href: string) => void;
	pendingFormatAction: { action: MarkdownAction; id: number } | null;
	renderedMarkdown: string;
}

type ScrollPanel = 'editor' | 'preview';

/**
 * Minimum content-area width (px) at which the floating outline can be shown
 */
const OUTLINE_MIN_CONTENT_WIDTH = 720;

interface ToolbarHistoryEntry {
	before: string;
	after: string;
}

function clampScrollTop(scrollTop: number, element: HTMLElement) {
	return Math.max(0, Math.min(element.scrollHeight - element.clientHeight, scrollTop));
}

function scrollCenterRatio(element: HTMLElement) {
	if (element.scrollHeight <= element.clientHeight) {
		return 0;
	}

	return Math.max(
		0,
		Math.min(1, (element.scrollTop + element.clientHeight / 2) / element.scrollHeight)
	);
}

export function PreviewPanel({
	outlinePanel,
	dropOverlay,
	actionBar,
	error,
	findBar,
	findTargetRef,
	mode,
	openFile,
	onContentChange,
	onLinkClick,
	pendingFormatAction,
	renderedMarkdown,
}: PreviewPanelProps) {
	const contentRef = useRef<HTMLElement | null>(null);
	const editorScrollRef = useRef<HTMLTextAreaElement | null>(null);
	const previewScrollRef = useRef<HTMLElement | null>(null);
	const visualEditorRootRef = useRef<HTMLDivElement | null>(null);
	const visualEditorRef = useRef<LexicalMarkdownEditorHandle | null>(null);
	const centerRatioRef = useRef(0);
	const ignoredScrollPanelRef = useRef<ScrollPanel | null>(null);
	const lastScrolledPanelRef = useRef<ScrollPanel>('preview');
	const appliedFormatActionIdRef = useRef(0);
	const undoStackRef = useRef<ToolbarHistoryEntry[]>([]);
	const redoStackRef = useRef<ToolbarHistoryEntry[]>([]);

	// Whether the content area is currently wide enough to fit the floating
	// outline alongside the readable column. Drives temporary auto-hide: when the
	// window shrinks past the threshold the outline is suppressed; growing back
	// reveals it again, all without touching the user's on/off preference.
	const [contentWideEnough, setContentWideEnough] = useState(true);

	// Measure the content area and track whether it clears the outline threshold.
	// Only runs while the host actually wants the outline shown (`outlinePanel` is
	// non-null), so there's no observer overhead otherwise.
	useEffect(() => {
		const element = contentRef.current;
		if (!outlinePanel || !element || typeof ResizeObserver === 'undefined') {
			// Nothing to suppress when the outline isn't requested.
			setContentWideEnough(true);
			return;
		}

		const update = (width: number) => {
			setContentWideEnough(width >= OUTLINE_MIN_CONTENT_WIDTH);
		};

		update(element.clientWidth);

		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				update(entry.contentRect.width);
			}
		});
		observer.observe(element);

		return () => observer.disconnect();
	}, [outlinePanel]);

	const showOutline = Boolean(outlinePanel) && contentWideEnough;

	const setPreviewScrollRef = useCallback((node: HTMLElement | null) => {
		previewScrollRef.current = node;
	}, []);

	useLayoutEffect(() => {
		if (!openFile) {
			findTargetRef.current = null;
			return;
		}

		if (mode === 'code' || (mode === 'edit' && openFile.kind !== 'md')) {
			findTargetRef.current = editorScrollRef.current;
			return;
		}

		if (mode === 'edit') {
			findTargetRef.current = visualEditorRootRef.current;
			return;
		}

		findTargetRef.current = previewScrollRef.current;
	}, [findTargetRef, mode, openFile]);

	const applyCenterRatio = useCallback((panel: ScrollPanel, ratio: number) => {
		const element = panel === 'editor' ? editorScrollRef.current : previewScrollRef.current;

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

		ignoredScrollPanelRef.current = panel;
		element.scrollTop = nextScrollTop;

		window.requestAnimationFrame(() => {
			if (ignoredScrollPanelRef.current === panel) {
				ignoredScrollPanelRef.current = null;
			}
		});
	}, []);

	const syncFromPanel = useCallback(
		(panel: ScrollPanel, element: HTMLElement) => {
			if (ignoredScrollPanelRef.current === panel) {
				ignoredScrollPanelRef.current = null;
				return;
			}

			const ratio = scrollCenterRatio(element);
			centerRatioRef.current = ratio;
			lastScrolledPanelRef.current = panel;
			applyCenterRatio(panel === 'editor' ? 'preview' : 'editor', ratio);
		},
		[applyCenterRatio]
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

	const handleEditorContentChange = useCallback(
		(content: string) => {
			if (editorScrollRef.current) {
				centerRatioRef.current = scrollCenterRatio(editorScrollRef.current);
				lastScrolledPanelRef.current = 'editor';
			}

			onContentChange(content);
		},
		[onContentChange]
	);

	const handleEditorKeyDown = useCallback(
		(event: KeyboardEvent<HTMLTextAreaElement>) => {
			if (event.key !== 'Tab' || event.ctrlKey || event.metaKey || event.altKey) {
				return;
			}

			const textarea = event.currentTarget;
			const { selectionStart, selectionEnd, value } = textarea;
			const indent = '\t';

			event.preventDefault();

			const hasLineSelection =
				selectionStart !== selectionEnd && value.slice(selectionStart, selectionEnd).includes('\n');

			if (hasLineSelection || event.shiftKey) {
				const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
				const before = value.slice(0, lineStart);
				const region = value.slice(lineStart, selectionEnd);
				const after = value.slice(selectionEnd);

				let newRegion: string;
				let firstLineDelta: number;
				let totalDelta: number;

				if (event.shiftKey) {
					let removedFirst = 0;
					let removedTotal = 0;
					newRegion = region
						.split('\n')
						.map((line, index) => {
							let removed = 0;
							if (line.startsWith('\t')) {
								removed = 1;
							} else {
								const spaces = line.match(/^ {1,2}/);
								removed = spaces ? spaces[0].length : 0;
							}
							if (index === 0) {
								removedFirst = removed;
							}
							removedTotal += removed;
							return line.slice(removed);
						})
						.join('\n');
					firstLineDelta = -removedFirst;
					totalDelta = -removedTotal;
				} else {
					const lines = region.split('\n');
					newRegion = lines.map((line) => indent + line).join('\n');
					firstLineDelta = indent.length;
					totalDelta = indent.length * lines.length;
				}

				const nextValue = before + newRegion + after;
				const nextStart = Math.max(lineStart, selectionStart + firstLineDelta);
				const nextEnd = selectionEnd + totalDelta;

				handleEditorContentChange(nextValue);
				window.requestAnimationFrame(() => {
					const el = editorScrollRef.current;
					if (el) {
						el.selectionStart = nextStart;
						el.selectionEnd = nextEnd;
					}
				});
				return;
			}

			const nextValue = value.slice(0, selectionStart) + indent + value.slice(selectionEnd);
			const caret = selectionStart + indent.length;

			handleEditorContentChange(nextValue);
			window.requestAnimationFrame(() => {
				const el = editorScrollRef.current;
				if (el) {
					el.selectionStart = caret;
					el.selectionEnd = caret;
				}
			});
		},
		[handleEditorContentChange]
	);

	const focusActiveEditor = useCallback(() => {
		window.requestAnimationFrame(() => {
			if (mode === 'edit' && openFile?.kind === 'md') {
				visualEditorRef.current?.focus();
				return;
			}

			editorScrollRef.current?.focus();
		});
	}, [mode, openFile?.kind]);

	const pushToolbarHistory = useCallback((before: string, after: string) => {
		if (before === after) {
			return;
		}

		undoStackRef.current = [...undoStackRef.current, { before, after }].slice(-100);
		redoStackRef.current = [];
	}, []);

	const undoToolbarAction = useCallback(() => {
		const entry = undoStackRef.current[undoStackRef.current.length - 1];
		if (!entry) {
			return false;
		}

		undoStackRef.current = undoStackRef.current.slice(0, -1);
		redoStackRef.current = [...redoStackRef.current, entry];
		onContentChange(entry.before);
		focusActiveEditor();
		return true;
	}, [focusActiveEditor, onContentChange]);

	const redoToolbarAction = useCallback(() => {
		const entry = redoStackRef.current[redoStackRef.current.length - 1];
		if (!entry) {
			return false;
		}

		redoStackRef.current = redoStackRef.current.slice(0, -1);
		undoStackRef.current = [...undoStackRef.current, entry];
		onContentChange(entry.after);
		focusActiveEditor();
		return true;
	}, [focusActiveEditor, onContentChange]);

	useEffect(() => {
		centerRatioRef.current = 0;
		ignoredScrollPanelRef.current = null;
		lastScrolledPanelRef.current = 'preview';
		undoStackRef.current = [];
		redoStackRef.current = [];
	}, [openFile?.path]);

	useEffect(() => {
		if (!openFile || openFile.kind !== 'md') {
			return;
		}

		function handleKeyDown(event: globalThis.KeyboardEvent) {
			const key = event.key.toLowerCase();
			const modifier = event.ctrlKey || event.metaKey;

			if (!modifier) {
				return;
			}

			if (key === 'z') {
				if (event.shiftKey ? redoToolbarAction() : undoToolbarAction()) {
					event.preventDefault();
				}
			}

			if (key === 'y' && redoToolbarAction()) {
				event.preventDefault();
			}
		}

		window.addEventListener('keydown', handleKeyDown);

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, [openFile, redoToolbarAction, undoToolbarAction]);

	useEffect(() => {
		if (!openFile) {
			return;
		}

		const frame = window.requestAnimationFrame(() => {
			applyCenterRatio('editor', centerRatioRef.current);
			applyCenterRatio('preview', centerRatioRef.current);
		});

		return () => window.cancelAnimationFrame(frame);
	}, [applyCenterRatio, mode, openFile?.path]);

	useEffect(() => {
		if (!openFile || mode === 'preview') {
			return;
		}

		const target = lastScrolledPanelRef.current === 'editor' ? 'preview' : 'editor';
		const frame = window.requestAnimationFrame(() => {
			applyCenterRatio(target, centerRatioRef.current);
		});

		return () => window.cancelAnimationFrame(frame);
	}, [applyCenterRatio, mode, openFile?.content, openFile?.path, renderedMarkdown]);

	useEffect(() => {
		if (
			!openFile ||
			openFile.kind !== 'md' ||
			!pendingFormatAction ||
			appliedFormatActionIdRef.current === pendingFormatAction.id
		) {
			return;
		}

		appliedFormatActionIdRef.current = pendingFormatAction.id;

		if (mode === 'edit') {
			const result = visualEditorRef.current?.applyAction(pendingFormatAction.action);
			if (result) {
				pushToolbarHistory(openFile.content, result.content);
			}
			return;
		}

		const editor = editorScrollRef.current;
		const selectionStart = editor?.selectionStart ?? openFile.content.length;
		const selectionEnd = editor?.selectionEnd ?? selectionStart;
		const result = applyMarkdownAction(
			openFile.content,
			selectionStart,
			selectionEnd,
			pendingFormatAction.action
		);

		pushToolbarHistory(openFile.content, result.content);
		onContentChange(result.content);

		window.requestAnimationFrame(() => {
			const currentEditor = editorScrollRef.current;
			if (!currentEditor) {
				return;
			}

			currentEditor.focus();
			currentEditor.setSelectionRange(result.selection.start, result.selection.end);
		});
	}, [mode, onContentChange, openFile, pendingFormatAction, pushToolbarHistory]);

	const previewContent = openFile ? (
		openFile.kind === 'md' ? (
			<MarkdownPreview
				ref={setPreviewScrollRef}
				html={renderedMarkdown}
				onScroll={handlePreviewScroll}
				onLinkClick={onLinkClick}
			/>
		) : (
			<PlainTextPreview
				ref={setPreviewScrollRef}
				content={openFile.content}
				onScroll={handlePreviewScroll}
			/>
		)
	) : null;

	return (
		<main
			ref={contentRef}
			className={`content ${showOutline ? 'has-outline-panel' : ''}`}
			aria-label="Markdown preview"
			data-drop-zone="main"
		>
			{dropOverlay}
			{error ? <Notice tone="error">{error}</Notice> : null}

			{openFile ? (
				<article className={`preview-pane mode-${mode}`}>
					{actionBar}
					{findBar}

					<div className="document-region">
						{showOutline ? outlinePanel : null}
						<div className="document-layout">
							{mode === 'edit' && openFile.kind === 'md' ? (
								<section
									className="document-panel rendered-panel visual-editor-panel"
									aria-label="Markdown editor"
								>
									<LexicalMarkdownEditor
										ref={visualEditorRef}
										content={openFile.content}
										onChange={handleEditorContentChange}
										onScroll={handlePreviewScroll}
										rootRef={visualEditorRootRef}
									/>
								</section>
							) : null}

							{mode === 'code' || (mode === 'edit' && openFile.kind !== 'md') ? (
								<section className="document-panel editor-panel" aria-label="Editor">
									<textarea
										ref={editorScrollRef}
										className="editor"
										spellCheck={false}
										value={openFile.content}
										onScroll={handleEditorScroll}
										onKeyDown={handleEditorKeyDown}
										onChange={(event) => handleEditorContentChange(event.target.value)}
									/>
								</section>
							) : null}

							{mode !== 'edit' ? (
								<section className="document-panel rendered-panel" aria-label="Preview">
									{previewContent}
								</section>
							) : null}
						</div>
					</div>

					<div className="file-meta">
						<span>{openFile.kind === 'md' ? 'Markdown' : 'Text'}</span>
						<span>{parentPath(openFile.path)}</span>
					</div>
				</article>
			) : (
				<EmptyPreview />
			)}
		</main>
	);
}
