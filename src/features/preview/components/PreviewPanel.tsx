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

interface ScrollSnapshot {
	scrollTop: number;
	centerRatio: number;
	clientHeight: number;
	scrollHeight: number;
}

interface TextSelectionSnapshot {
	start: number;
	end: number;
	version: number;
}

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

function markdownSyntaxSpan(markdown: string, index: number): number {
	const lineStart = index === 0 || markdown[index - 1] === '\n';
	const rest = markdown.slice(index);

	if (lineStart) {
		const blockMarker = rest.match(/^ {0,3}(?:#{1,6}\s+|>\s?|(?:[-+*]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)/);
		if (blockMarker) {
			return blockMarker[0].length;
		}
	}

	const char = markdown[index];
	if (char === '\\' && index + 1 < markdown.length) {
		return 1;
	}
	if (char === '!' && markdown[index + 1] === '[') {
		return 1;
	}
	if (char === '[' || char === ']') {
		return 1;
	}
	if (char === '(' && index > 0 && markdown[index - 1] === ']') {
		const end = markdown.indexOf(')', index + 1);
		return end === -1 ? 1 : end - index + 1;
	}
	if (char === '*' || char === '_' || char === '`' || char === '~') {
		return 1;
	}

	return 0;
}

function markdownTextOffsetFromSourceOffset(markdown: string, sourceOffset: number) {
	const target = Math.max(0, Math.min(sourceOffset, markdown.length));
	let textOffset = 0;

	for (let index = 0; index < target; index += 1) {
		const syntaxSpan = markdownSyntaxSpan(markdown, index);
		if (syntaxSpan > 0) {
			index += syntaxSpan - 1;
			continue;
		}

		textOffset += 1;
	}

	return textOffset;
}

function markdownSourceOffsetFromTextOffset(markdown: string, textOffset: number) {
	const target = Math.max(0, textOffset);
	let visibleOffset = 0;

	for (let index = 0; index < markdown.length; index += 1) {
		const syntaxSpan = markdownSyntaxSpan(markdown, index);
		if (syntaxSpan > 0) {
			index += syntaxSpan - 1;
			continue;
		}

		if (visibleOffset >= target) {
			return index;
		}

		visibleOffset += 1;
		if (visibleOffset >= target) {
			return index + 1;
		}
	}

	return markdown.length;
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
	const ignoredScrollPanelsRef = useRef<Set<ScrollPanel>>(new Set());
	const lastScrolledPanelRef = useRef<ScrollPanel>('preview');
	const scrollSnapshotsRef = useRef<Record<string, ScrollSnapshot>>({});
	const sharedFileRatioRef = useRef<Record<string, number>>({});
	const selectionSnapshotsRef = useRef<Record<string, TextSelectionSnapshot>>({});
	const selectionVersionRef = useRef(0);
	const lastFocusRestoreKeyRef = useRef('');
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

	const filePositionKey = openFile?.path ?? '';

	const scrollSnapshotKey = useCallback(
		(panel: ScrollPanel) => `${filePositionKey}:${mode}:${panel}`,
		[filePositionKey, mode]
	);

	const selectionSnapshotKey = useCallback(
		(targetMode: FileViewMode) => `${filePositionKey}:${targetMode}`,
		[filePositionKey]
	);

	const rememberSelectionSnapshot = useCallback(
		(targetMode: FileViewMode, selection: Omit<TextSelectionSnapshot, 'version'>) => {
			selectionVersionRef.current += 1;
			const version = selectionVersionRef.current;
			selectionSnapshotsRef.current[selectionSnapshotKey(targetMode)] = {
				...selection,
				version,
			};

			if (!openFile || openFile.kind !== 'md' || targetMode === 'preview') {
				return;
			}

			if (targetMode === 'edit') {
				selectionSnapshotsRef.current[selectionSnapshotKey('code')] = {
					start: markdownSourceOffsetFromTextOffset(openFile.content, selection.start),
					end: markdownSourceOffsetFromTextOffset(openFile.content, selection.end),
					version,
				};
				return;
			}

			selectionSnapshotsRef.current[selectionSnapshotKey('edit')] = {
				start: markdownTextOffsetFromSourceOffset(openFile.content, selection.start),
				end: markdownTextOffsetFromSourceOffset(openFile.content, selection.end),
				version,
			};
		},
		[openFile, selectionSnapshotKey]
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
		[mode, openFile?.kind]
	);

	const rememberScrollSnapshot = useCallback(
		(panel: ScrollPanel, element: HTMLElement) => {
			if (!openFile) {
				return;
			}

			const centerRatio = scrollCenterRatio(element);
			centerRatioRef.current = centerRatio;
			sharedFileRatioRef.current[filePositionKey] = centerRatio;
			scrollSnapshotsRef.current[scrollSnapshotKey(panel)] = {
				scrollTop: element.scrollTop,
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

	const rememberTextareaSelection = useCallback(() => {
		const editor = editorScrollRef.current;
		if (!openFile || !editor) {
			return;
		}

		rememberSelectionSnapshot(mode, {
			start: editor.selectionStart,
			end: editor.selectionEnd,
		});
	}, [mode, openFile, rememberSelectionSnapshot]);

	const rememberVisualSelection = useCallback(() => {
		if (!openFile || mode !== 'edit' || openFile.kind !== 'md') {
			return;
		}

		const selection = visualEditorRef.current?.getSelection();
		if (selection) {
			rememberSelectionSnapshot('edit', selection);
		}
	}, [mode, openFile, rememberSelectionSnapshot]);

	const selectionForMode = useCallback(
		(targetMode: FileViewMode): TextSelectionSnapshot | null => {
			if (!openFile) {
				return null;
			}

			const exact = selectionSnapshotsRef.current[selectionSnapshotKey(targetMode)];
			if (targetMode === 'preview') {
				return null;
			}

			const siblingMode = targetMode === 'edit' ? 'code' : 'edit';
			const sibling = selectionSnapshotsRef.current[selectionSnapshotKey(siblingMode)];
			if (exact && (!sibling || exact.version >= sibling.version)) {
				return exact;
			}

			if (!sibling || openFile.kind !== 'md') {
				return exact ?? sibling ?? null;
			}

			if (targetMode === 'edit') {
				return {
					start: markdownTextOffsetFromSourceOffset(openFile.content, sibling.start),
					end: markdownTextOffsetFromSourceOffset(openFile.content, sibling.end),
					version: sibling.version,
				};
			}

			return {
				start: markdownSourceOffsetFromTextOffset(openFile.content, sibling.start),
				end: markdownSourceOffsetFromTextOffset(openFile.content, sibling.end),
				version: sibling.version,
			};
		},
		[openFile, selectionSnapshotKey]
	);

	const restoreScrollSnapshots = useCallback(() => {
		if (!openFile) {
			return;
		}

		const fallbackRatio = sharedFileRatioRef.current[filePositionKey] ?? 0;

		for (const panel of activeScrollPanels()) {
			const element = getPanelElement(panel);
			if (!element || element.clientHeight === 0 || element.scrollHeight === 0) {
				continue;
			}

			const snapshot = scrollSnapshotsRef.current[scrollSnapshotKey(panel)];
			const restoreRatio = snapshot?.centerRatio ?? fallbackRatio;
			const nextScrollTop =
				snapshot &&
				snapshot.clientHeight === element.clientHeight &&
				snapshot.scrollHeight === element.scrollHeight
					? clampScrollTop(snapshot.scrollTop, element)
					: clampScrollTop(restoreRatio * element.scrollHeight - element.clientHeight / 2, element);

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
	}, [getPanelElement]);

	const syncFromPanel = useCallback(
		(panel: ScrollPanel, element: HTMLElement) => {
			if (ignoredScrollPanelsRef.current.has(panel)) {
				ignoredScrollPanelsRef.current.delete(panel);
				return;
			}

			const ratio = scrollCenterRatio(element);
			rememberScrollSnapshot(panel, element);
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

	const handleEditorContentChange = useCallback(
		(content: string) => {
			if (editorScrollRef.current) {
				rememberScrollSnapshot('editor', editorScrollRef.current);
				rememberTextareaSelection();
				centerRatioRef.current = scrollCenterRatio(editorScrollRef.current);
				lastScrolledPanelRef.current = 'editor';
			} else {
				rememberVisualSelection();
			}

			onContentChange(content);
		},
		[onContentChange, rememberScrollSnapshot, rememberTextareaSelection, rememberVisualSelection]
	);

	const handleEditorKeyDown = useCallback(
		(event: KeyboardEvent<HTMLTextAreaElement>) => {
			if (event.key !== 'Tab' || event.ctrlKey || event.metaKey || event.altKey) {
				window.requestAnimationFrame(rememberTextareaSelection);
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
						rememberSelectionSnapshot(mode, {
							start: nextStart,
							end: nextEnd,
						});
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
						rememberSelectionSnapshot(mode, {
							start: caret,
							end: caret,
						});
					}
				});
		},
		[handleEditorContentChange, mode, rememberSelectionSnapshot, rememberTextareaSelection]
	);

	const focusActiveEditor = useCallback(() => {
		window.requestAnimationFrame(() => {
			if (mode === 'edit' && openFile?.kind === 'md') {
				visualEditorRef.current?.focus();
				return;
			}

			editorScrollRef.current?.focus({ preventScroll: true });
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
		centerRatioRef.current = openFile ? (sharedFileRatioRef.current[filePositionKey] ?? 0) : 0;
		ignoredScrollPanelsRef.current.clear();
		lastScrolledPanelRef.current = 'preview';
		undoStackRef.current = [];
		redoStackRef.current = [];
	}, [filePositionKey, openFile]);

	useLayoutEffect(() => {
		return () => {
			rememberTextareaSelection();
			rememberVisualSelection();
		};
	}, [mode, openFile?.path, rememberTextareaSelection, rememberVisualSelection]);

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
			lastFocusRestoreKeyRef.current = '';
			return;
		}

		const target = lastScrolledPanelRef.current === 'editor' ? 'preview' : 'editor';
		const frame = window.requestAnimationFrame(() => {
			if (mode === 'code') {
				applyCenterRatio(target, centerRatioRef.current);
			}
		});

		return () => window.cancelAnimationFrame(frame);
	}, [applyCenterRatio, mode, openFile?.content, openFile?.path, renderedMarkdown]);

	useEffect(() => {
		if (!openFile || mode === 'preview') {
			return;
		}

		const focusRestoreKey = `${openFile.path}:${openFile.kind}:${mode}`;
		if (lastFocusRestoreKeyRef.current === focusRestoreKey) {
			return;
		}
		lastFocusRestoreKeyRef.current = focusRestoreKey;

		const frame = window.requestAnimationFrame(() => {
			const selection = selectionForMode(mode);

			if (mode === 'edit' && openFile.kind === 'md') {
				if (selection) {
					visualEditorRef.current?.restoreSelection(selection);
				} else {
					visualEditorRef.current?.focus();
				}
				return;
			}

			const editor = editorScrollRef.current;
			if (!editor) {
				return;
			}

			editor.focus({ preventScroll: true });
			if (selection) {
				const start = Math.max(0, Math.min(selection.start, editor.value.length));
				const end = Math.max(0, Math.min(selection.end, editor.value.length));
				editor.setSelectionRange(start, end);
			}
		});

		return () => window.cancelAnimationFrame(frame);
	}, [mode, openFile?.kind, openFile?.path, selectionForMode]);

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

			currentEditor.focus({ preventScroll: true });
			currentEditor.setSelectionRange(result.selection.start, result.selection.end);
			rememberSelectionSnapshot(mode, result.selection);
		});
	}, [mode, onContentChange, openFile, pendingFormatAction, pushToolbarHistory, rememberSelectionSnapshot]);

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
										onSelectionChange={rememberVisualSelection}
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
										onKeyUp={rememberTextareaSelection}
										onClick={rememberTextareaSelection}
										onSelect={rememberTextareaSelection}
										onBlur={rememberTextareaSelection}
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
