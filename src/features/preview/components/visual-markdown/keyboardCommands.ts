import {
	closestAncestor,
	collapsedSelectionInside,
	findEditableBlock,
	placeCaretAtEnd,
	placeCaretInTextNode,
	selectionInside,
} from './domSelection';

function closestListItem(node: Node, root: HTMLElement) {
	let current: Node | null = node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode;

	while (current && current !== root) {
		if (current instanceof HTMLElement && current.tagName.toLowerCase() === 'li') {
			return current;
		}
		current = current.parentNode;
	}

	return null;
}

function indentListItem(item: HTMLElement) {
	const previous = item.previousElementSibling;
	if (!(previous instanceof HTMLElement) || previous.tagName.toLowerCase() !== 'li') {
		return false;
	}

	const parentList = item.parentElement;
	const listTag = parentList?.tagName.toLowerCase() === 'ol' ? 'ol' : 'ul';

	let sublist = Array.from(previous.children).find(
		(child): child is HTMLElement =>
			child instanceof HTMLElement && ['ul', 'ol'].includes(child.tagName.toLowerCase())
	);

	if (!sublist) {
		sublist = document.createElement(listTag);
		if (parentList instanceof HTMLElement && parentList.className) {
			sublist.className = parentList.className;
		}
		previous.append(sublist);
	}

	sublist.append(item);
	return true;
}

function outdentListItem(item: HTMLElement, root: HTMLElement) {
	const parentList = item.parentElement;
	const grandItem = parentList?.parentElement;
	if (
		!parentList ||
		!(grandItem instanceof HTMLElement) ||
		grandItem.tagName.toLowerCase() !== 'li' ||
		!root.contains(grandItem)
	) {
		return false;
	}

	const following: HTMLElement[] = [];
	let sibling = item.nextElementSibling;
	while (sibling instanceof HTMLElement) {
		following.push(sibling);
		sibling = sibling.nextElementSibling;
	}

	grandItem.after(item);

	if (following.length > 0) {
		const tail = document.createElement(parentList.tagName.toLowerCase());
		if (parentList instanceof HTMLElement && parentList.className) {
			tail.className = parentList.className;
		}
		following.forEach((node) => tail.append(node));
		item.append(tail);
	}

	if (parentList.children.length === 0) {
		parentList.remove();
	}

	return true;
}

function findFirstTextNode(node: Node): Text | null {
	if (node.nodeType === Node.TEXT_NODE) {
		return node as Text;
	}
	for (const child of Array.from(node.childNodes)) {
		const found = findFirstTextNode(child);
		if (found) {
			return found;
		}
	}
	return null;
}

function removeLeadingIndentAtCaret(editor: HTMLElement, range: Range, selection: Selection) {
	const block = findEditableBlock(range.startContainer, editor);

	const firstEl = block.firstElementChild;
	if (
		firstEl instanceof HTMLElement &&
		firstEl.classList.contains('md-tab') &&
		!firstEl.previousSibling
	) {
		const after = firstEl.nextSibling;
		firstEl.remove();
		const caret = document.createRange();
		if (after) {
			caret.setStart(after, 0);
		} else {
			caret.selectNodeContents(block);
			caret.collapse(true);
		}
		caret.collapse(true);
		selection.removeAllRanges();
		selection.addRange(caret);
		return true;
	}

	const firstText = findFirstTextNode(block);
	if (!firstText) {
		return true;
	}

	const match = firstText.data.match(/^(\t| {1,2})/);
	if (match) {
		firstText.deleteData(0, match[0].length);
	}

	const caret = document.createRange();
	caret.setStart(firstText, 0);
	caret.collapse(true);
	selection.removeAllRanges();
	selection.addRange(caret);
	return true;
}

export function insertTabAtSelection(editor: HTMLElement, outdent: boolean) {
	const current = selectionInside(editor);
	if (!current) {
		return false;
	}

	const { selection, range } = current;
	const listItem = closestListItem(range.startContainer, editor);

	if (listItem) {
		const changed = outdent ? outdentListItem(listItem, editor) : indentListItem(listItem);

		if (changed) {
			placeCaretAtEnd(listItem);
		}
		return true;
	}

	if (outdent) {
		return removeLeadingIndentAtCaret(editor, range, selection);
	}

	range.deleteContents();
	const tab = document.createElement('span');
	tab.className = 'md-tab';
	tab.textContent = '\t';
	range.insertNode(tab);

	const caret = document.createRange();
	caret.setStartAfter(tab);
	caret.collapse(true);
	selection.removeAllRanges();
	selection.addRange(caret);

	return true;
}

function paragraphWithBreak() {
	const paragraph = document.createElement('p');
	const spacer = document.createElement('br');
	paragraph.append(spacer);
	return paragraph;
}

export function escapeCodeBlock(editor: HTMLElement) {
	const range = collapsedSelectionInside(editor);
	if (!range) {
		return false;
	}

	const pre = closestAncestor(range.startContainer, 'pre', editor);
	if (!pre) {
		return false;
	}

	const paragraph = paragraphWithBreak();
	pre.insertAdjacentElement('afterend', paragraph);
	placeCaretAtEnd(paragraph);
	return true;
}

export function deleteEmptyCodeAtCaret(editor: HTMLElement) {
	const range = collapsedSelectionInside(editor);
	if (!range) {
		return false;
	}

	const inlineCode = closestAncestor(range.startContainer, 'code', editor);
	const pre = closestAncestor(range.startContainer, 'pre', editor);

	if (inlineCode && !pre && (inlineCode.textContent ?? '').length === 0) {
		const next = inlineCode.nextSibling;
		inlineCode.remove();

		if (next?.nodeType === Node.TEXT_NODE) {
			placeCaretInTextNode(next as Text, 0);
		} else {
			placeCaretAtEnd(editor);
		}

		return true;
	}

	if (pre && (pre.textContent ?? '').length === 0) {
		const paragraph = paragraphWithBreak();
		pre.replaceWith(paragraph);
		placeCaretAtEnd(paragraph);
		return true;
	}

	return false;
}
