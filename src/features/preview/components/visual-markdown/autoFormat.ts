import {
	blockTextBeforeCaret,
	collapsedSelectionInside,
	findEditableBlock,
	hasAncestor,
	placeCaretAfterNode,
	placeCaretInTextNode,
	replaceBlockWithElement,
	textNodeAtCaret,
} from './domSelection';

function replaceTextRangeWithNodes(
	textNode: Text,
	start: number,
	end: number,
	nodes: Node[],
	caretNode?: Text,
	caretOffset?: number
) {
	const parent = textNode.parentNode;
	if (!parent) {
		return false;
	}

	const value = textNode.data;
	const before = value.slice(0, start);
	const after = value.slice(end);
	const anchor = textNode.nextSibling;

	textNode.data = before;

	for (const node of nodes) {
		parent.insertBefore(node, anchor);
	}

	if (after) {
		parent.insertBefore(document.createTextNode(after), anchor);
	}

	if (caretNode) {
		placeCaretInTextNode(caretNode, caretOffset);
	} else {
		placeCaretAfterNode(nodes[nodes.length - 1]);
	}

	return true;
}

function inlineAutoFormatBeforeInput(editor: HTMLElement, data: string) {
	const range = collapsedSelectionInside(editor);
	if (!range) {
		return false;
	}

	const caret = textNodeAtCaret(range);
	if (!caret || hasAncestor(caret.node, ['code', 'pre', 'a'])) {
		return false;
	}

	const beforeCaret = caret.node.data.slice(0, caret.offset);
	const candidate = beforeCaret + data;
	const patterns: Array<{
		regex: RegExp;
		tagName: string;
		trailingSpace?: boolean;
	}> = [
		{ regex: /(^|[\s([{])\*\*([^*\n]+)\*\*$/, tagName: 'strong' },
		{ regex: /(^|[\s([{])__([^_\n]+)__$/, tagName: 'strong' },
		{ regex: /(^|[\s([{])`([^`\n]+)`$/, tagName: 'code', trailingSpace: true },
		{ regex: /(^|[\s([{])\*([^*\n]+)\*$/, tagName: 'em' },
		{ regex: /(^|[\s([{])_([^_\n]+)_$/, tagName: 'em' },
	];

	for (const pattern of patterns) {
		const match = candidate.match(pattern.regex);
		if (!match || match.index === undefined) {
			continue;
		}

		const matchStart = match.index + match[1].length;
		const element = document.createElement(pattern.tagName);
		const text = document.createTextNode(match[2]);
		const insertedNodes: Node[] = [element];

		element.append(text);

		let caretNode: Text | undefined;
		let caretOffset: number | undefined;
		if (pattern.trailingSpace) {
			caretNode = document.createTextNode(' ');
			caretOffset = 1;
			insertedNodes.push(caretNode);
		}

		return replaceTextRangeWithNodes(
			caret.node,
			matchStart,
			caret.offset,
			insertedNodes,
			caretNode,
			caretOffset
		);
	}

	return false;
}

function blockAutoFormatBeforeInput(editor: HTMLElement, data: string) {
	const range = collapsedSelectionInside(editor);
	if (!range) {
		return false;
	}

	const block = findEditableBlock(range.startContainer, editor);
	const blockTag = block?.tagName.toLowerCase();
	if (!block || blockTag === 'pre' || hasAncestor(block, ['code', 'pre'])) {
		return false;
	}

	const beforeCaret = blockTextBeforeCaret(block, range);
	const fullText = block.textContent ?? '';

	if (data === ' ') {
		if (beforeCaret === '#') {
			const heading = document.createElement('h1');
			const text = document.createTextNode(fullText.slice(1));
			heading.append(text);
			replaceBlockWithElement(block, heading, text);
			return true;
		}

		if (beforeCaret === '##') {
			const heading = document.createElement('h2');
			const text = document.createTextNode(fullText.slice(2));
			heading.append(text);
			replaceBlockWithElement(block, heading, text);
			return true;
		}

		if (beforeCaret === '###') {
			const heading = document.createElement('h3');
			const text = document.createTextNode(fullText.slice(3));
			heading.append(text);
			replaceBlockWithElement(block, heading, text);
			return true;
		}

		if (beforeCaret === '>') {
			const quote = document.createElement('blockquote');
			const text = document.createTextNode(fullText.slice(1));
			quote.append(text);
			replaceBlockWithElement(block, quote, text);
			return true;
		}

		if (beforeCaret === '-' || beforeCaret === '*') {
			const list = document.createElement('ul');
			const item = document.createElement('li');
			const text = document.createTextNode(fullText.slice(1));
			item.append(text);
			list.append(item);
			replaceBlockWithElement(block, list, text);
			return true;
		}

		if (beforeCaret === '1.') {
			const list = document.createElement('ol');
			const item = document.createElement('li');
			const text = document.createTextNode(fullText.slice(2));
			item.append(text);
			list.append(item);
			replaceBlockWithElement(block, list, text);
			return true;
		}

		if (beforeCaret === '- [ ]' || beforeCaret === '- [x]') {
			const list = document.createElement('ul');
			const item = document.createElement('li');
			const checkbox = document.createElement('input');
			const text = document.createTextNode(fullText.slice(5));

			list.className = 'contains-task-list';
			item.className = 'task-list-item';
			checkbox.className = 'task-list-item-checkbox';
			checkbox.type = 'checkbox';
			checkbox.contentEditable = 'false';
			checkbox.checked = beforeCaret === '- [x]';
			item.append(checkbox, ' ', text);
			list.append(item);
			replaceBlockWithElement(block, list, text);
			return true;
		}
	}

	if (data === '`' && beforeCaret === '``') {
		const pre = document.createElement('pre');
		const code = document.createElement('code');
		const text = document.createTextNode(fullText.slice(2));
		code.append(text);
		pre.append(code);
		replaceBlockWithElement(block, pre, text);
		return true;
	}

	return false;
}

export function autoFormatBeforeInput(editor: HTMLElement, data: string) {
	return blockAutoFormatBeforeInput(editor, data) || inlineAutoFormatBeforeInput(editor, data);
}
