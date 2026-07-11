import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
	type ChangeEvent,
	type FormEvent,
	type KeyboardEvent,
	type RefObject,
	type UIEventHandler,
} from 'react';
import { type MarkdownAction, type MarkdownActionResult } from '../markdownActions';
import { autoFormatBeforeInput } from './visual-markdown/autoFormat';
import { applyVisualMarkdownAction } from './visual-markdown/formatActions';
import {
	deleteEmptyCodeAtCaret,
	escapeCodeBlock,
	insertTabAtSelection,
} from './visual-markdown/keyboardCommands';
import { serializeEditor } from './visual-markdown/serialize';
import { enableEditorCheckboxes } from './visual-markdown/taskLists';

interface VisualMarkdownEditorProps {
	content: string;
	html: string;
	onChange: (content: string) => void;
	onScroll: UIEventHandler<HTMLDivElement>;
	rootRef?: RefObject<HTMLDivElement | null>;
}

export interface VisualMarkdownEditorHandle {
	applyAction: (action: MarkdownAction) => MarkdownActionResult | null;
	focus: () => void;
}

export const VisualMarkdownEditor = forwardRef<
	VisualMarkdownEditorHandle,
	VisualMarkdownEditorProps
>(function VisualMarkdownEditor({ content, html, onChange, onScroll, rootRef }, ref) {
	const editorRef = useRef<HTMLDivElement | null>(null);
	const focusedRef = useRef(false);
	const lastSyncedContentRef = useRef(content);

	const setEditorRef = useCallback(
		(node: HTMLDivElement | null) => {
			editorRef.current = node;
			if (rootRef) {
				rootRef.current = node;
			}
		},
		[rootRef]
	);

	const syncHtml = useCallback(() => {
		const editor = editorRef.current;
		if (!editor) {
			return;
		}

		editor.innerHTML = html;
		enableEditorCheckboxes(editor);
		lastSyncedContentRef.current = content;
	}, [content, html]);

	useEffect(() => {
		if (focusedRef.current && lastSyncedContentRef.current === content) {
			return;
		}

		syncHtml();
	}, [content, syncHtml]);

	const commitDom = useCallback(() => {
		const editor = editorRef.current;
		if (!editor) {
			return '';
		}

		const nextContent = serializeEditor(editor);
		const previousContent = lastSyncedContentRef.current;
		lastSyncedContentRef.current = nextContent;

		if (nextContent !== previousContent) {
			onChange(nextContent);
		}

		return nextContent;
	}, [onChange]);

	useImperativeHandle(
		ref,
		() => ({
			applyAction(action) {
				const editor = editorRef.current;
				if (!editor || !applyVisualMarkdownAction(editor, action)) {
					return null;
				}

				const content = commitDom();
				const cursor = content.length;

				return { content, selection: { start: cursor, end: cursor } };
			},
			focus() {
				editorRef.current?.focus();
			},
		}),
		[commitDom]
	);

	const handleBeforeInput = useCallback(
		(event: FormEvent<HTMLDivElement>) => {
			const inputEvent = event.nativeEvent as InputEvent;
			const editor = editorRef.current;

			if (!editor || inputEvent.inputType !== 'insertText' || !inputEvent.data) {
				return;
			}

			if (autoFormatBeforeInput(editor, inputEvent.data)) {
				event.preventDefault();
				commitDom();
			}
		},
		[commitDom]
	);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			const editor = editorRef.current;
			if (!editor) {
				return;
			}

			if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey) {
				if (insertTabAtSelection(editor, event.shiftKey)) {
					event.preventDefault();
					commitDom();
				}
				return;
			}

			if (event.key === 'Enter' && event.shiftKey && escapeCodeBlock(editor)) {
				event.preventDefault();
				commitDom();
				return;
			}

			if (event.key === 'Backspace' && deleteEmptyCodeAtCaret(editor)) {
				event.preventDefault();
				commitDom();
			}
		},
		[commitDom]
	);

	const handleChange = useCallback(
		(event: ChangeEvent<HTMLDivElement>) => {
			const target = event.target;
			if (target instanceof HTMLInputElement && target.type === 'checkbox') {
				commitDom();
			}
		},
		[commitDom]
	);

	return (
		<div
			ref={setEditorRef}
			className="preview-inner md visual-markdown-editor"
			contentEditable
			data-find-content="true"
			role="textbox"
			aria-label="Markdown editor"
			aria-multiline="true"
			spellCheck={false}
			suppressContentEditableWarning
			onBlur={() => {
				focusedRef.current = false;
				syncHtml();
			}}
			onFocus={() => {
				focusedRef.current = true;
			}}
			onBeforeInput={handleBeforeInput}
			onChange={handleChange}
			onInput={commitDom}
			onKeyDown={handleKeyDown}
			onScroll={onScroll}
		/>
	);
});
