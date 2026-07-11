import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	type KeyboardEvent,
	type RefObject,
} from 'react';
import type { FileViewMode } from '../../file-actions/components/FileActionControls';
import type { OpenFile } from '../../../shared/types/files';
import { applyMarkdownAction, type MarkdownAction } from '../markdownActions';
import type { LexicalMarkdownEditorHandle } from '../components/LexicalMarkdownEditor';

interface PendingFormatAction {
	action: MarkdownAction;
	id: number;
}

interface TextSelectionSnapshot {
	start: number;
	end: number;
}

interface ToolbarHistoryEntry {
	before: string;
	after: string;
}

interface UseCodeEditorToolbarOptions {
	editorScrollRef: RefObject<HTMLTextAreaElement | null>;
	mode: FileViewMode;
	onContentChange: (content: string) => void;
	openFile: OpenFile | null;
	pendingFormatAction: PendingFormatAction | null;
	rememberEditorScrollPosition: () => void;
	visualEditorRef: RefObject<LexicalMarkdownEditorHandle | null>;
}

export function useCodeEditorToolbar({
	editorScrollRef,
	mode,
	onContentChange,
	openFile,
	pendingFormatAction,
	rememberEditorScrollPosition,
	visualEditorRef,
}: UseCodeEditorToolbarOptions) {
	const selectionSnapshotsRef = useRef<Record<string, TextSelectionSnapshot>>({});
	const lastFocusRestoreKeyRef = useRef('');
	const appliedFormatActionIdRef = useRef(0);
	const undoStackRef = useRef<ToolbarHistoryEntry[]>([]);
	const redoStackRef = useRef<ToolbarHistoryEntry[]>([]);

	const filePositionKey = openFile?.path ?? '';

	const selectionSnapshotKey = useCallback(
		(targetMode: FileViewMode) => `${filePositionKey}:${targetMode}`,
		[filePositionKey]
	);

	const rememberSelectionSnapshot = useCallback(
		(targetMode: FileViewMode, selection: TextSelectionSnapshot) => {
			selectionSnapshotsRef.current[selectionSnapshotKey(targetMode)] = selection;
		},
		[selectionSnapshotKey]
	);

	const rememberTextareaSelection = useCallback(() => {
		const editor = editorScrollRef.current;
		if (!openFile || !editor) {
			return;
		}

		rememberSelectionSnapshot(mode, {
			start: editor.selectionStart,
			end: editor.selectionEnd,
		});
	}, [editorScrollRef, mode, openFile, rememberSelectionSnapshot]);

	const selectionForMode = useCallback(
		(targetMode: FileViewMode): TextSelectionSnapshot | null => {
			if (!openFile) {
				return null;
			}

			if (targetMode === 'preview') {
				return null;
			}

			return selectionSnapshotsRef.current[selectionSnapshotKey(targetMode)] ?? null;
		},
		[openFile, selectionSnapshotKey]
	);

	const handleEditorContentChange = useCallback(
		(content: string) => {
			rememberEditorScrollPosition();
			rememberTextareaSelection();
			onContentChange(content);
		},
		[onContentChange, rememberEditorScrollPosition, rememberTextareaSelection]
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
		[
			editorScrollRef,
			handleEditorContentChange,
			mode,
			rememberSelectionSnapshot,
			rememberTextareaSelection,
		]
	);

	const focusActiveEditor = useCallback(() => {
		window.requestAnimationFrame(() => {
			if (mode === 'edit' && openFile?.kind === 'md') {
				visualEditorRef.current?.focus();
				return;
			}

			editorScrollRef.current?.focus({ preventScroll: true });
		});
	}, [editorScrollRef, mode, openFile?.kind, visualEditorRef]);

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
		undoStackRef.current = [];
		redoStackRef.current = [];
	}, [filePositionKey, openFile]);

	useLayoutEffect(() => {
		return () => {
			rememberTextareaSelection();
		};
	}, [mode, openFile?.path, rememberTextareaSelection]);

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
		if (!openFile || mode === 'preview') {
			lastFocusRestoreKeyRef.current = '';
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
				visualEditorRef.current?.focus();
				return;
			}

			const editor = editorScrollRef.current;
			if (!editor) {
				return;
			}

			editor.focus({ preventScroll: true });
			if (!selection) {
				return;
			}

			const start = Math.max(0, Math.min(selection.start, editor.value.length));
			const end = Math.max(0, Math.min(selection.end, editor.value.length));
			editor.setSelectionRange(start, end);
		});

		return () => window.cancelAnimationFrame(frame);
	}, [
		editorScrollRef,
		mode,
		openFile,
		openFile?.kind,
		openFile?.path,
		selectionForMode,
		visualEditorRef,
	]);

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
	}, [
		editorScrollRef,
		mode,
		onContentChange,
		openFile,
		pendingFormatAction,
		pushToolbarHistory,
		rememberSelectionSnapshot,
		visualEditorRef,
	]);

	return {
		handleEditorContentChange,
		handleEditorKeyDown,
		rememberTextareaSelection,
	};
}
