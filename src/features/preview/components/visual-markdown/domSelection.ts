export function selectionInside(element: HTMLElement) {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0) {
		return null;
	}

	const range = selection.getRangeAt(0);
	if (
		!element.contains(range.commonAncestorContainer) &&
		range.commonAncestorContainer !== element
	) {
		return null;
	}

	return { selection, range };
}

export function collapsedSelectionInside(element: HTMLElement) {
	const currentSelection = selectionInside(element);
	if (!currentSelection || !currentSelection.range.collapsed) {
		return null;
	}

	return currentSelection.range;
}

export function selectNodeContents(node: Node) {
	const range = document.createRange();
	range.selectNodeContents(node);

	const selection = window.getSelection();
	selection?.removeAllRanges();
	selection?.addRange(range);
}

export function placeCaretAfterNode(node: Node) {
	const range = document.createRange();
	range.setStartAfter(node);
	range.collapse(true);

	const selection = window.getSelection();
	selection?.removeAllRanges();
	selection?.addRange(range);
}

export function placeCaretInTextNode(node: Text, offset = node.data.length) {
	const range = document.createRange();
	range.setStart(node, Math.max(0, Math.min(offset, node.data.length)));
	range.collapse(true);

	const selection = window.getSelection();
	selection?.removeAllRanges();
	selection?.addRange(range);
}

export function placeCaretAfter(node: Node) {
	const range = document.createRange();
	range.setStartAfter(node);
	range.collapse(true);

	const selection = window.getSelection();
	selection?.removeAllRanges();
	selection?.addRange(range);
}

export function placeCaretAtEnd(element: HTMLElement) {
	const range = document.createRange();
	range.selectNodeContents(element);
	range.collapse(false);

	const selection = window.getSelection();
	selection?.removeAllRanges();
	selection?.addRange(range);
}

export function textNodeAtCaret(range: Range) {
	if (range.startContainer.nodeType === Node.TEXT_NODE) {
		return {
			node: range.startContainer as Text,
			offset: range.startOffset,
		};
	}

	const child = range.startContainer.childNodes[range.startOffset - 1];
	if (child?.nodeType === Node.TEXT_NODE) {
		return {
			node: child as Text,
			offset: child.textContent?.length ?? 0,
		};
	}

	return null;
}

export function hasAncestor(node: Node, tags: string[]) {
	let current: Node | null = node.parentNode;
	const tagSet = new Set(tags.map((tag) => tag.toLowerCase()));

	while (current) {
		if (current instanceof HTMLElement && tagSet.has(current.tagName.toLowerCase())) {
			return true;
		}

		current = current.parentNode;
	}

	return false;
}

export function closestAncestor(node: Node, tagName: string, root: HTMLElement) {
	let current: Node | null = node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode;
	const normalized = tagName.toLowerCase();

	while (current && current !== root) {
		if (current instanceof HTMLElement && current.tagName.toLowerCase() === normalized) {
			return current;
		}

		current = current.parentNode;
	}

	return null;
}

export function findEditableBlock(node: Node, root: HTMLElement) {
	let current: Node | null = node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode;

	while (current && current !== root) {
		if (current instanceof HTMLElement) {
			const tag = current.tagName.toLowerCase();
			if (['h1', 'h2', 'h3', 'h4', 'p', 'div', 'blockquote', 'li', 'pre'].includes(tag)) {
				return current;
			}
		}

		current = current.parentNode;
	}

	return root;
}

export function blockTextBeforeCaret(block: HTMLElement, range: Range) {
	const blockRange = document.createRange();
	blockRange.selectNodeContents(block);
	blockRange.setEnd(range.startContainer, range.startOffset);
	return blockRange.toString();
}

export function replaceBlockWithElement(
	block: HTMLElement,
	element: HTMLElement,
	selectedNode?: Node
) {
	if (block.isContentEditable && block.classList.contains('visual-markdown-editor')) {
		block.replaceChildren(element);
	} else {
		block.replaceWith(element);
	}

	if (selectedNode) {
		selectNodeContents(selectedNode);
	} else {
		placeCaretAtEnd(element);
	}
}
