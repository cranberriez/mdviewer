/**
 * highlight.js-backed tokenizer for Lexical's code blocks.
 *
 * Lexical ships a Prism-based tokenizer (`@lexical/code-prism`), but the preview
 * pane renders code with **highlight.js** (`markdown-it`'s `highlight` hook in
 * `features/preview/markdown.ts`). To keep the editor and the preview visually
 * identical, we drive the editor's syntax highlighting with the same engine and
 * reuse the preview's `.hljs-*` colour rules (see `markdown.css`).
 *
 * `registerCodeHighlighting(editor, tokenizer)` (from `@lexical/code`) owns the
 * reconciler-safe machinery: it watches `CodeNode`s and replaces their children
 * with the `LexicalNode[]` our `$tokenize` returns. We only have to:
 *   1. run `hljs.highlight()` (or `highlightAuto`) to get an HTML token tree,
 *   2. walk that tree into `CodeHighlightNode` + `LineBreakNode` + `TabNode`,
 *      tagging each `CodeHighlightNode` with a `highlightType` that the editor
 *      theme (`theme.codeHighlight`) maps to an `.hljs-*` class.
 */
import { $createCodeHighlightNode, registerCodeHighlighting, type CodeNode } from '@lexical/code';
import { $createLineBreakNode, $createTabNode, type LexicalNode } from 'lexical';
import hljs from 'highlight.js/lib/common';

// `registerCodeHighlighting(editor, tokenizer)` — derive the tokenizer shape
// from its own signature so we don't have to add `@lexical/code-prism` as a
// direct dependency just for the `Tokenizer` type.
type Tokenizer = NonNullable<Parameters<typeof registerCodeHighlighting>[1]>;
type TokenizerToken = ReturnType<Tokenizer['tokenize']>[number];

const PLAIN_TEXT_LANGUAGES = new Set(['text', 'txt', 'plain', 'plaintext', 'nohighlight']);

/**
 * highlight.js emits nested `<span class="hljs-keyword hljs-…">`. The scope is
 * the class with the `hljs-` prefix stripped. We pass that bare scope name
 * through as the Lexical `highlightType`; the editor theme maps it to the
 * matching `.hljs-<scope>` class so the colour comes from the preview's
 * stylesheet. We keep the first hljs scope class found (hljs may stack a couple,
 * e.g. `hljs-variable hljs-constant_`, but the leading one carries the colour).
 */
function scopeFromClassName(className: string): string | undefined {
	for (const cls of className.split(/\s+/)) {
		if (cls.startsWith('hljs-')) {
			return cls.slice('hljs-'.length);
		}
	}
	return undefined;
}

/**
 * Recursively turn an hljs HTML node tree into Lexical nodes. Text runs become
 * `CodeHighlightNode`s (split on `\n`/`\t` into line-break / tab nodes, which is
 * what `@lexical/code`'s indent + shift-line handlers require). The active
 * `highlightType` is inherited from the nearest enclosing hljs span.
 */
function appendDomNode(
	node: ChildNode,
	highlightType: string | undefined,
	out: LexicalNode[]
): void {
	if (node.nodeType === Node.TEXT_NODE) {
		const text = node.textContent ?? '';
		const lines = text.split('\n');
		lines.forEach((line, lineIdx) => {
			if (lineIdx > 0) {
				out.push($createLineBreakNode());
			}
			const tabParts = line.split('\t');
			tabParts.forEach((part, partIdx) => {
				if (partIdx > 0) {
					out.push($createTabNode());
				}
				if (part.length > 0) {
					const hl = $createCodeHighlightNode(part);
					if (highlightType) {
						hl.setHighlightType(highlightType);
					}
					out.push(hl);
				}
			});
		});
		return;
	}

	if (node.nodeType === Node.ELEMENT_NODE) {
		const el = node as HTMLElement;
		const nextType = scopeFromClassName(el.className) ?? highlightType;
		el.childNodes.forEach((child) => appendDomNode(child, nextType, out));
	}
}

function highlightToHtml(code: string, language?: string): string {
	const lang = (language ?? '').trim().toLowerCase();

	if (!lang || PLAIN_TEXT_LANGUAGES.has(lang)) {
		// No language (or an explicit plain-text language): leave it uncoloured.
		// Returning an escaped-but-classless string means `appendDomNode` produces
		// plain CodeHighlightNodes (no highlightType), matching the preview.
		return escapeHtml(code);
	}

	if (hljs.getLanguage(lang)) {
		try {
			return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
		} catch {
			return escapeHtml(code);
		}
	}

	// Unknown language string: mirror the preview's `highlightAuto` fallback.
	try {
		return hljs.highlightAuto(code).value;
	} catch {
		return escapeHtml(code);
	}
}

function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const hljsTokenizer: Tokenizer = {
	// null => code blocks with no info string stay untouched (no implicit
	// language, no `data-language`), so a markdown round-trip preserves bare ```.
	defaultLanguage: null,

	// `tokenize` is part of the Tokenizer contract but is only used by the default
	// `$tokenize`. We override `$tokenize` directly, so this is a thin shim.
	tokenize(code: string): TokenizerToken[] {
		return [code];
	},

	$tokenize(codeNode: CodeNode, language?: string): LexicalNode[] {
		const code = codeNode.getTextContent();
		const html = highlightToHtml(code, language ?? undefined);

		const template = document.createElement('template');
		template.innerHTML = html;

		const out: LexicalNode[] = [];
		template.content.childNodes.forEach((child) => appendDomNode(child, undefined, out));
		return out;
	},
};
