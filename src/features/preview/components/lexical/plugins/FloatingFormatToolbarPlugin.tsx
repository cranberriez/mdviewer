/**
 * A lightweight floating format toolbar. Pops up above the current text
 * selection with the common inline formats. This is a lean custom
 * implementation (not the bulky playground plugin): it reuses our existing
 * `applyMarkdownActionToEditor` so behaviour matches the main toolbar.
 */
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { mergeRegister } from '@lexical/utils';
import {
	$getSelection,
	$isRangeSelection,
	COMMAND_PRIORITY_LOW,
	SELECTION_CHANGE_COMMAND,
	type LexicalEditor,
} from 'lexical';
import { Bold, Code, Italic, Link, Strikethrough, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';
import type { MarkdownAction } from '../../../markdownActions';
import { applyMarkdownActionToEditor } from '../applyAction';

const BUTTONS: Array<{ action: MarkdownAction; Icon: LucideIcon; label: string }> = [
	{ action: 'bold', Icon: Bold, label: 'Bold' },
	{ action: 'italic', Icon: Italic, label: 'Italic' },
	{ action: 'strike', Icon: Strikethrough, label: 'Strikethrough' },
	{ action: 'inlineCode', Icon: Code, label: 'Inline code' },
	{ action: 'link', Icon: Link, label: 'Link' },
];

function getDOMRangeRect(): DOMRect | null {
	const nativeSelection = window.getSelection();
	if (!nativeSelection || nativeSelection.rangeCount === 0 || nativeSelection.isCollapsed) {
		return null;
	}
	const range = nativeSelection.getRangeAt(0);
	const rect = range.getBoundingClientRect();
	if (rect.width === 0 && rect.height === 0) {
		return null;
	}
	return rect;
}

function FloatingToolbar({ editor }: { editor: LexicalEditor }): JSX.Element {
	const toolbarRef = useRef<HTMLDivElement | null>(null);
	const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

	const updatePosition = useCallback(() => {
		const toolbar = toolbarRef.current;
		if (!toolbar) {
			return;
		}

		const selection = $getSelection();
		if (!$isRangeSelection(selection) || selection.isCollapsed()) {
			setPosition(null);
			return;
		}

		const rect = getDOMRangeRect();
		if (!rect) {
			setPosition(null);
			return;
		}

		const toolbarHeight = toolbar.offsetHeight || 36;
		const toolbarWidth = toolbar.offsetWidth || 180;
		let top = rect.top - toolbarHeight - 8 + window.scrollY;
		let left = rect.left + rect.width / 2 - toolbarWidth / 2 + window.scrollX;

		// Keep within viewport horizontally.
		left = Math.max(8, Math.min(left, window.innerWidth - toolbarWidth - 8));
		// Flip below the selection if there's no room above.
		if (top < window.scrollY + 8) {
			top = rect.bottom + 8 + window.scrollY;
		}

		setPosition({ top, left });
	}, [editor]);

	useEffect(() => {
		const scrollOrResize = () => editor.getEditorState().read(() => updatePosition());

		document.addEventListener('scroll', scrollOrResize, true);
		window.addEventListener('resize', scrollOrResize);

		return () => {
			document.removeEventListener('scroll', scrollOrResize, true);
			window.removeEventListener('resize', scrollOrResize);
		};
	}, [editor, updatePosition]);

	useEffect(() => {
		return mergeRegister(
			editor.registerUpdateListener(({ editorState }) => {
				editorState.read(() => updatePosition());
			}),
			editor.registerCommand(
				SELECTION_CHANGE_COMMAND,
				() => {
					updatePosition();
					return false;
				},
				COMMAND_PRIORITY_LOW
			)
		);
	}, [editor, updatePosition]);

	const onAction = useCallback(
		(action: MarkdownAction) => {
			applyMarkdownActionToEditor(editor, action);
		},
		[editor]
	);

	return (
		<div
			ref={toolbarRef}
			className="lexical-floating-toolbar"
			style={
				position
					? { top: position.top, left: position.left }
					: { opacity: 0, pointerEvents: 'none', top: -1000, left: -1000 }
			}
			// Prevent the editor from losing its selection when clicking a button.
			onMouseDown={(event) => event.preventDefault()}
		>
			{BUTTONS.map(({ action, Icon, label }) => (
				<button
					key={action}
					type="button"
					className="lexical-floating-toolbar-button"
					title={label}
					aria-label={label}
					onClick={() => onAction(action)}
				>
					<Icon size={15} />
				</button>
			))}
		</div>
	);
}

export default function FloatingFormatToolbarPlugin(): JSX.Element | null {
	const [editor] = useLexicalComposerContext();
	return createPortal(<FloatingToolbar editor={editor} />, document.body);
}
