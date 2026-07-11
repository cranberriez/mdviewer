/**
 * Floating link editor. When the selection sits inside a link, a small popover
 * appears showing the URL with edit / open / remove actions. Lean custom
 * implementation using TOGGLE_LINK_COMMAND.
 */
import { $isLinkNode, $isAutoLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $findMatchingParent, mergeRegister } from '@lexical/utils';
import {
	$getSelection,
	$isRangeSelection,
	COMMAND_PRIORITY_LOW,
	SELECTION_CHANGE_COMMAND,
	type LexicalEditor,
} from 'lexical';
// Icons restricted to those confirmed present in this repo's lucide-react@1.21.0
// fork (Save, SquareArrowOutUpRight, Pencil, Trash2 are all used elsewhere).
import { Pencil, Save, SquareArrowOutUpRight, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';

function getSelectionRect(): DOMRect | null {
	const nativeSelection = window.getSelection();
	if (!nativeSelection || nativeSelection.rangeCount === 0) {
		return null;
	}
	const rect = nativeSelection.getRangeAt(0).getBoundingClientRect();
	if (rect.width === 0 && rect.height === 0) {
		return null;
	}
	return rect;
}

function LinkEditor({ editor }: { editor: LexicalEditor }): JSX.Element {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
	const [linkUrl, setLinkUrl] = useState('');
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState('');

	const update = useCallback(() => {
		const selection = $getSelection();
		if (!$isRangeSelection(selection)) {
			setPosition(null);
			return;
		}

		const node = selection.anchor.getNode();
		const linkNode = $findMatchingParent(
			node,
			(parent) => $isLinkNode(parent) || $isAutoLinkNode(parent)
		);

		if (!linkNode || $isAutoLinkNode(linkNode)) {
			setPosition(null);
			setIsEditing(false);
			return;
		}

		const url = $isLinkNode(linkNode) ? linkNode.getURL() : '';
		setLinkUrl(url);

		const rect = getSelectionRect();
		if (!rect) {
			setPosition(null);
			return;
		}

		setPosition({
			top: rect.bottom + 8 + window.scrollY,
			left: rect.left + window.scrollX,
		});
	}, []);

	useEffect(() => {
		const onScroll = () => editor.getEditorState().read(() => update());
		document.addEventListener('scroll', onScroll, true);
		window.addEventListener('resize', onScroll);
		return () => {
			document.removeEventListener('scroll', onScroll, true);
			window.removeEventListener('resize', onScroll);
		};
	}, [editor, update]);

	useEffect(() => {
		return mergeRegister(
			editor.registerUpdateListener(({ editorState }) => {
				editorState.read(() => update());
			}),
			editor.registerCommand(
				SELECTION_CHANGE_COMMAND,
				() => {
					update();
					return false;
				},
				COMMAND_PRIORITY_LOW
			)
		);
	}, [editor, update]);

	const startEditing = useCallback(() => {
		setEditValue(linkUrl);
		setIsEditing(true);
		window.requestAnimationFrame(() => inputRef.current?.focus());
	}, [linkUrl]);

	const confirmEdit = useCallback(() => {
		const next = editValue.trim();
		if (next) {
			editor.dispatchCommand(TOGGLE_LINK_COMMAND, next);
		}
		setIsEditing(false);
	}, [editValue, editor]);

	const removeLink = useCallback(() => {
		editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
		setIsEditing(false);
		setPosition(null);
	}, [editor]);

	if (!position) {
		return <div ref={containerRef} style={{ display: 'none' }} />;
	}

	return (
		<div
			ref={containerRef}
			className="lexical-link-editor"
			style={{ top: position.top, left: position.left }}
			onMouseDown={(event) => {
				// Keep editor selection unless we're interacting with the text input.
				if (event.target !== inputRef.current) {
					event.preventDefault();
				}
			}}
		>
			{isEditing ? (
				<>
					<input
						ref={inputRef}
						className="lexical-link-editor-input"
						value={editValue}
						placeholder="https://…"
						onChange={(event) => setEditValue(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === 'Enter') {
								event.preventDefault();
								confirmEdit();
							} else if (event.key === 'Escape') {
								event.preventDefault();
								setIsEditing(false);
							}
						}}
					/>
					<button
						type="button"
						className="lexical-link-editor-button"
						title="Save"
						aria-label="Save link"
						onClick={confirmEdit}
					>
						<Save size={15} />
					</button>
				</>
			) : (
				<>
					<a
						className="lexical-link-editor-url"
						href={linkUrl}
						target="_blank"
						rel="noopener noreferrer"
						title={linkUrl}
					>
						{linkUrl || '(empty)'}
					</a>
					<button
						type="button"
						className="lexical-link-editor-button"
						title="Open in browser"
						aria-label="Open link"
						onClick={() => window.open(linkUrl, '_blank', 'noopener')}
					>
						<SquareArrowOutUpRight size={15} />
					</button>
					<button
						type="button"
						className="lexical-link-editor-button"
						title="Edit"
						aria-label="Edit link"
						onClick={startEditing}
					>
						<Pencil size={15} />
					</button>
					<button
						type="button"
						className="lexical-link-editor-button"
						title="Remove"
						aria-label="Remove link"
						onClick={removeLink}
					>
						<Trash2 size={15} />
					</button>
				</>
			)}
		</div>
	);
}

export default function FloatingLinkEditorPlugin(): JSX.Element {
	const [editor] = useLexicalComposerContext();
	return createPortal(<LinkEditor editor={editor} />, document.body);
}
