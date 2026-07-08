import { type MarkdownAction } from '../../markdownActions';
import {
	placeCaretAfter,
	placeCaretAtEnd,
	placeCaretInTextNode,
	selectNodeContents,
	selectionInside,
} from './domSelection';

function selectedTextFromRange(range: Range) {
	return range.toString();
}

function insertElementAtRange(range: Range, element: HTMLElement, selectedNode?: Node) {
	range.deleteContents();
	range.insertNode(element);

	if (selectedNode) {
		selectNodeContents(selectedNode);
	} else {
		placeCaretAfter(element);
	}
}

function insertInlineElement(range: Range, tagName: string, fallbackText: string) {
	const element = document.createElement(tagName);
	const text = document.createTextNode(selectedTextFromRange(range) || fallbackText);
	element.append(text);

	if (tagName.toLowerCase() === 'code') {
		const trailingSpace = document.createTextNode(' ');
		range.deleteContents();
		range.insertNode(element);
		element.parentNode?.insertBefore(trailingSpace, element.nextSibling);
		placeCaretInTextNode(trailingSpace);
		return;
	}

	insertElementAtRange(range, element, text);
}

function insertLink(range: Range) {
	const anchor = document.createElement('a');
	anchor.href = 'url';
	const text = document.createTextNode(selectedTextFromRange(range) || 'text');
	anchor.append(text);
	insertElementAtRange(range, anchor, text);
}

function insertImage(range: Range) {
	const image = document.createElement('img');
	image.alt = selectedTextFromRange(range) || 'alt';
	image.src = 'url';
	insertElementAtRange(range, image);
}

function insertCodeBlock(range: Range) {
	const pre = document.createElement('pre');
	const code = document.createElement('code');
	const text = document.createTextNode(selectedTextFromRange(range) || 'code');
	code.append(text);
	pre.append(code);
	insertElementAtRange(range, pre, text);
}

function insertChecklist(range: Range) {
	const selected = selectedTextFromRange(range);
	const lines = (selected || 'Task')
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
	const list = document.createElement('ul');
	let selectedNode: Node | undefined;

	list.className = 'contains-task-list';
	for (const line of lines) {
		const item = document.createElement('li');
		const checkbox = document.createElement('input');
		const text = document.createTextNode(line);

		item.className = 'task-list-item';
		checkbox.className = 'task-list-item-checkbox';
		checkbox.type = 'checkbox';
		checkbox.contentEditable = 'false';
		item.append(checkbox, ' ', text);
		list.append(item);
		selectedNode ??= text;
	}

	insertElementAtRange(range, list, selectedNode);
}

function insertTable(range: Range) {
	const table = document.createElement('table');
	const thead = document.createElement('thead');
	const tbody = document.createElement('tbody');
	const headRow = document.createElement('tr');
	const bodyRow = document.createElement('tr');
	let firstCellText: Text | undefined;

	for (const label of ['Col', 'Col']) {
		const cell = document.createElement('th');
		const text = document.createTextNode(label);
		firstCellText ??= text;
		cell.append(text);
		headRow.append(cell);
	}

	for (const label of ['a', 'b']) {
		const cell = document.createElement('td');
		cell.append(document.createTextNode(label));
		bodyRow.append(cell);
	}

	thead.append(headRow);
	tbody.append(bodyRow);
	table.append(thead, tbody);
	insertElementAtRange(range, table, firstCellText);
}

export function applyVisualMarkdownAction(editor: HTMLElement, action: MarkdownAction) {
	const currentSelection = selectionInside(editor);
	if (!currentSelection) {
		editor.focus();
		placeCaretAtEnd(editor);
	}

	const range = currentSelection?.range ?? window.getSelection()?.getRangeAt(0) ?? null;
	if (!range) {
		return false;
	}

	if (action === 'bold') {
		document.execCommand('bold');
	} else if (action === 'italic') {
		document.execCommand('italic');
	} else if (action === 'strike') {
		document.execCommand('strikeThrough');
	} else if (action === 'heading') {
		document.execCommand('formatBlock', false, 'h1');
	} else if (action === 'quote') {
		document.execCommand('formatBlock', false, 'blockquote');
	} else if (action === 'bulletList') {
		document.execCommand('insertUnorderedList');
	} else if (action === 'numberedList') {
		document.execCommand('insertOrderedList');
	} else if (action === 'link') {
		if (range.collapsed) {
			insertLink(range);
		} else {
			document.execCommand('createLink', false, 'url');
		}
	} else if (action === 'inlineCode') {
		insertInlineElement(range, 'code', 'code');
	} else if (action === 'image') {
		insertImage(range);
	} else if (action === 'codeBlock') {
		insertCodeBlock(range);
	} else if (action === 'checkList') {
		insertChecklist(range);
	} else if (action === 'table') {
		insertTable(range);
	}

	return true;
}
