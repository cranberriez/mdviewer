/**
 * Turn heading text into a URL-fragment slug, GitHub-style: lowercase, spaces to
 * hyphens, punctuation stripped. Kept deliberately simple and dependency-free so
 * the renderer (which stamps `id`s onto headings) and the link handler (which
 * resolves `#fragment` clicks) agree on the same value.
 */
export function slugify(text: string) {
	return text
		.trim()
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s-]/gu, '')
		.replace(/\s+/g, '-');
}

/**
 * Tracks slugs already emitted within a single document so duplicate headings
 * get a numeric suffix (`title`, `title-1`, `title-2`), matching GitHub. Create
 * one per render pass.
 */
export function createSlugTracker() {
	const seen = new Map<string, number>();

	return function uniqueSlug(text: string) {
		const base = slugify(text) || 'section';
		const count = seen.get(base) ?? 0;
		seen.set(base, count + 1);
		return count === 0 ? base : `${base}-${count}`;
	};
}
