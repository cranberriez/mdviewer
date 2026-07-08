function escapeTableCell(value: string) {
	return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').trim();
}

function serializeInline(node: Node): string {
	if (node.nodeType === Node.TEXT_NODE) {
		return node.textContent ?? '';
	}

	if (!(node instanceof HTMLElement)) {
		return Array.from(node.childNodes).map(serializeInline).join('');
	}

	const body = Array.from(node.childNodes).map(serializeInline).join('');
	const tag = node.tagName.toLowerCase();

	if (tag === 'br') {
		return '\n';
	}

	if (tag === 'strong' || tag === 'b') {
		return `**${body}**`;
	}

	if (tag === 'em' || tag === 'i') {
		return `*${body}*`;
	}

	if (tag === 'del' || tag === 's') {
		return `~~${body}~~`;
	}

	if (tag === 'code' && node.parentElement?.tagName.toLowerCase() !== 'pre') {
		return `\`${node.textContent ?? ''}\``;
	}

	if (tag === 'a') {
		return `[${body}](${node.getAttribute('href') ?? ''})`;
	}

	if (tag === 'img') {
		return `![${node.getAttribute('alt') ?? ''}](${node.getAttribute('src') ?? ''})`;
	}

	return body;
}

function isListElement(node: Node) {
	return node instanceof HTMLElement && ['ul', 'ol'].includes(node.tagName.toLowerCase());
}

function directChildCheckbox(element: HTMLElement) {
	return Array.from(element.children).find(
		(child): child is HTMLInputElement =>
			child instanceof HTMLInputElement && child.type === 'checkbox'
	);
}

function serializeListItemInline(element: HTMLElement) {
	return Array.from(element.childNodes)
		.filter((child) => child !== directChildCheckbox(element) && !isListElement(child))
		.map(serializeInline)
		.join('')
		.trim();
}

function indentNestedList(value: string) {
	return value
		.trimEnd()
		.split('\n')
		.map((line) => (line ? `  ${line}` : line))
		.join('\n');
}

function serializeBlock(node: Node): string {
	if (node.nodeType === Node.TEXT_NODE) {
		return node.textContent ?? '';
	}

	if (!(node instanceof HTMLElement)) {
		return Array.from(node.childNodes).map(serializeBlock).join('');
	}

	const tag = node.tagName.toLowerCase();

	if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
		const level = Number(tag.slice(1));
		return `${'#'.repeat(level)} ${serializeInline(node).trim()}\n\n`;
	}

	if (tag === 'p' || tag === 'div') {
		return `${serializeInline(node).trimEnd()}\n\n`;
	}

	if (tag === 'blockquote') {
		const quote = serializeInline(node)
			.trim()
			.split('\n')
			.map((line) => `> ${line}`)
			.join('\n');
		return `${quote}\n\n`;
	}

	if (tag === 'pre') {
		return `\`\`\`\n${node.textContent?.replace(/\n$/, '') ?? ''}\n\`\`\`\n\n`;
	}

	if (tag === 'ul' || tag === 'ol') {
		const ordered = tag === 'ol';
		const items = Array.from(node.children)
			.filter((child) => child.tagName.toLowerCase() === 'li')
			.map((child, index) => {
				const checkbox = directChildCheckbox(child as HTMLElement);
				const prefix = checkbox
					? `- [${checkbox.checked ? 'x' : ' '}] `
					: ordered
						? `${index + 1}. `
						: '- ';
				const nestedLists = Array.from(child.children)
					.filter(isListElement)
					.map((list) => indentNestedList(serializeBlock(list)));
				return [`${prefix}${serializeListItemInline(child as HTMLElement)}`, ...nestedLists]
					.filter(Boolean)
					.join('\n');
			});
		return `${items.join('\n')}\n\n`;
	}

	if (tag === 'table') {
		const rows = Array.from(node.querySelectorAll('tr')).map((row) =>
			Array.from(row.children).map((cell) => escapeTableCell(serializeInline(cell)))
		);
		const [head, ...body] = rows;
		if (!head) {
			return '';
		}

		return [
			`| ${head.join(' | ')} |`,
			`| ${head.map(() => '---').join(' | ')} |`,
			...body.map((row) => `| ${row.join(' | ')} |`),
			'',
			'',
		].join('\n');
	}

	if (tag === 'hr') {
		return '---\n\n';
	}

	return Array.from(node.childNodes).map(serializeBlock).join('');
}

export function serializeEditor(element: HTMLElement) {
	return Array.from(element.childNodes)
		.map(serializeBlock)
		.join('')
		.replace(/\n{3,}/g, '\n\n')
		.trimEnd();
}
