const FRONTMATTER_DELIMITER = '---';

function isFrontmatterDelimiter(line: string) {
	return line.trim() === FRONTMATTER_DELIMITER;
}

export interface YamlFrontmatterParts {
	frontmatter: string;
	body: string;
}

export function splitYamlFrontmatter(content: string): YamlFrontmatterParts | null {
	const linePattern = /(.*?)(\r\n|\n|\r|$)/g;
	const lines: Array<{ text: string; end: number }> = [];
	let match: RegExpExecArray | null;

	while ((match = linePattern.exec(content)) !== null) {
		lines.push({
			text: match[1],
			end: linePattern.lastIndex,
		});

		if (match[2] === '') {
			break;
		}
	}

	if (!lines[0] || !isFrontmatterDelimiter(lines[0].text)) {
		return null;
	}

	for (let index = 1; index < lines.length; index += 1) {
		if (!isFrontmatterDelimiter(lines[index].text)) {
			continue;
		}

		const frontmatter = content.slice(0, lines[index].end).replace(/(?:\r\n|\n|\r)$/, '');
		const body = content.slice(lines[index].end).replace(/^(?:\r\n|\n|\r)+/, '');
		return { frontmatter, body };
	}

	return null;
}

export function joinYamlFrontmatter(frontmatter: string, body: string) {
	const normalizedBody = body.replace(/^(?:\r\n|\n|\r)+/, '');
	return normalizedBody.trim() ? `${frontmatter}\n\n${normalizedBody}` : `${frontmatter}\n`;
}

/**
 * Hide a document-start YAML frontmatter block from rendered preview while
 * leaving the editable source untouched.
 */
export function stripYamlFrontmatterForPreview(content: string) {
	return splitYamlFrontmatter(content)?.body ?? content;
}

/**
 * Keep markdown saves POSIX-friendly and predictable without touching plain
 * text files.
 */
export function normalizeMarkdownForSave(content: string) {
	return `${content.replace(/[ \t\r\n]+$/g, '')}\n`;
}
