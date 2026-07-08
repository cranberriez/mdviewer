/**
 * Lean table row/column controls. When the caret is inside a table cell, a
 * small toolbar appears at the table's top-left with buttons to insert/delete
 * a row or column at the current selection. Uses @lexical/table's
 * *AtSelection helpers (0.45 names; the older __EXPERIMENTAL aliases were
 * renamed to these).
 */
import {
	$deleteTableColumnAtSelection,
	$deleteTableRowAtSelection,
	$insertTableColumnAtSelection,
	$insertTableRowAtSelection,
	$isTableNode,
} from '@lexical/table';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $findMatchingParent, mergeRegister } from '@lexical/utils';
import {
	$getSelection,
	$isRangeSelection,
	COMMAND_PRIORITY_LOW,
	SELECTION_CHANGE_COMMAND,
	type LexicalEditor,
	type NodeKey,
} from 'lexical';
import { ArrowDownToLine, ArrowUpToLine, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';

function TableActions({ editor }: { editor: LexicalEditor }): JSX.Element {
	const [tableKey, setTableKey] = useState<NodeKey | null>(null);
	const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

	const update = useCallback(() => {
		const selection = $getSelection();
		if (!$isRangeSelection(selection)) {
			setTableKey(null);
			setPosition(null);
			return;
		}

		const tableNode = $findMatchingParent(selection.anchor.getNode(), $isTableNode);
		if (!$isTableNode(tableNode)) {
			setTableKey(null);
			setPosition(null);
			return;
		}

		const key = tableNode.getKey();
		setTableKey(key);

		const dom = editor.getElementByKey(key);
		if (!dom) {
			setPosition(null);
			return;
		}
		const rect = dom.getBoundingClientRect();
		setPosition({
			top: rect.top - 34 + window.scrollY,
			left: rect.left + window.scrollX,
		});
	}, [editor]);

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

	const run = useCallback(
		(fn: () => void) => {
			editor.update(() => {
				const selection = $getSelection();
				if ($isRangeSelection(selection)) {
					fn();
				}
			});
		},
		[editor]
	);

	if (!position || !tableKey) {
		return <div style={{ display: 'none' }} />;
	}

	return (
		<div
			className="lexical-table-actions"
			style={{ top: position.top, left: position.left }}
			onMouseDown={(event) => event.preventDefault()}
		>
			<button
				type="button"
				className="lexical-table-actions-button"
				title="Insert row above"
				aria-label="Insert row above"
				onClick={() => run(() => $insertTableRowAtSelection(false))}
			>
				<ArrowUpToLine size={14} />
				<span>Row</span>
			</button>
			<button
				type="button"
				className="lexical-table-actions-button"
				title="Insert row below"
				aria-label="Insert row below"
				onClick={() => run(() => $insertTableRowAtSelection(true))}
			>
				<ArrowDownToLine size={14} />
				<span>Row</span>
			</button>
			<button
				type="button"
				className="lexical-table-actions-button"
				title="Insert column left"
				aria-label="Insert column left"
				onClick={() => run(() => $insertTableColumnAtSelection(false))}
			>
				<ArrowUpToLine size={14} className="lexical-rotate-left" />
				<span>Col</span>
			</button>
			<button
				type="button"
				className="lexical-table-actions-button"
				title="Insert column right"
				aria-label="Insert column right"
				onClick={() => run(() => $insertTableColumnAtSelection(true))}
			>
				<ArrowDownToLine size={14} className="lexical-rotate-left" />
				<span>Col</span>
			</button>
			<span className="lexical-table-actions-divider" />
			<button
				type="button"
				className="lexical-table-actions-button danger"
				title="Delete row"
				aria-label="Delete row"
				onClick={() => run(() => $deleteTableRowAtSelection())}
			>
				<Trash2 size={14} />
				<span>Row</span>
			</button>
			<button
				type="button"
				className="lexical-table-actions-button danger"
				title="Delete column"
				aria-label="Delete column"
				onClick={() => run(() => $deleteTableColumnAtSelection())}
			>
				<Trash2 size={14} />
				<span>Col</span>
			</button>
		</div>
	);
}

export default function TableActionsPlugin(): JSX.Element {
	const [editor] = useLexicalComposerContext();
	return createPortal(<TableActions editor={editor} />, document.body);
}
