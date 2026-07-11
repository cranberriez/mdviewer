/**
 * Outline extraction. The markdown renderer (`features/preview/markdown.ts`)
 * already stamps GitHub-style slug `id`s onto every heading via a core rule, and
 * the link handler in `App.tsx` resolves `#fragment` clicks against those same
 * ids. Rather than re-parse the markdown source (and risk drifting from the
 * renderer's slugging), we read the headings straight out of the rendered HTML
 * string. That guarantees every outline entry points at an id that actually
 * exists in the preview DOM.
 */

export interface OutlineHeading {
	/** Heading level, 1–6 (from h1–h6). */
	level: number;
	/** Visible heading text. */
	text: string;
	/** Slug id stamped onto the heading; the scroll/anchor target. */
	id: string;
}

const HEADING_PATTERN = /<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;
const ID_PATTERN = /\bid\s*=\s*("([^"]*)"|'([^']*)')/i;

/** Collapse rendered heading markup to the text React will render in the outline. */
function plainText(html: string): string {
	const parsed = new DOMParser().parseFromString(html, 'text/html');
	return (parsed.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Parse the headings out of rendered markdown HTML, in document order. Headings
 * without an id (shouldn't happen given the renderer's core rule, but kept
 * defensive) are skipped, since they can't be scrolled to. Pure.
 */
export function extractOutline(renderedHtml: string): OutlineHeading[] {
	if (!renderedHtml) {
		return [];
	}

	const headings: OutlineHeading[] = [];
	for (const match of renderedHtml.matchAll(HEADING_PATTERN)) {
		const level = Number(match[1]);
		const attrs = match[2] ?? '';
		const inner = match[3] ?? '';

		const idMatch = ID_PATTERN.exec(attrs);
		const id = idMatch ? (idMatch[2] ?? idMatch[3] ?? '') : '';
		const text = plainText(inner);

		if (!id || !text) {
			continue;
		}

		headings.push({ level, text, id });
	}

	return headings;
}

/**
 * Normalise heading levels so the shallowest heading in the document renders at
 * indent depth 0, regardless of whether the doc starts at h1 or h2. Each entry
 * gets a `depth` relative to the minimum level present. Pure.
 */
export function withRelativeDepth(
	headings: OutlineHeading[]
): (OutlineHeading & { depth: number })[] {
	if (headings.length === 0) {
		return [];
	}

	const minLevel = headings.reduce((min, h) => Math.min(min, h.level), 6);
	return headings.map((h) => ({ ...h, depth: h.level - minLevel }));
}
