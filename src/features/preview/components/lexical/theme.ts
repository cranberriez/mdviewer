import type { EditorThemeClasses } from 'lexical';

/**
 * Lexical applies these class names to the DOM it renders. We keep them
 * namespaced under `lexical-*` and style them in `lexical.css`, while leaning
 * on the existing `.md` element styles (h1, p, ul, code, …) for the bulk of
 * the look so the editor matches the preview pane.
 */
export const lexicalTheme: EditorThemeClasses = {
	paragraph: 'lexical-paragraph',
	quote: 'lexical-quote',
	heading: {
		h1: 'lexical-h1',
		h2: 'lexical-h2',
		h3: 'lexical-h3',
		h4: 'lexical-h4',
		h5: 'lexical-h5',
		h6: 'lexical-h6',
	},
	list: {
		nested: {
			listitem: 'lexical-nested-listitem',
		},
		ol: 'lexical-ol',
		ul: 'lexical-ul',
		listitem: 'lexical-listitem',
		listitemChecked: 'lexical-listitem-checked',
		listitemUnchecked: 'lexical-listitem-unchecked',
		checklist: 'lexical-checklist',
	},
	link: 'lexical-link',
	text: {
		bold: 'lexical-text-bold',
		italic: 'lexical-text-italic',
		strikethrough: 'lexical-text-strikethrough',
		underline: 'lexical-text-underline',
		code: 'lexical-text-code',
	},
	code: 'lexical-code',
	// Keys are highlight.js *scope* names (the class minus its `hljs-` prefix),
	// emitted by `hljsTokenizer`. Each maps back to the matching `.hljs-<scope>`
	// class so the editor reuses the preview's highlight.js palette (markdown.css)
	// and the two stay pixel-identical. hljs scopes not listed here fall back to
	// the default code colour, which is the correct behaviour for unknown scopes.
	codeHighlight: {
		comment: 'hljs-comment',
		quote: 'hljs-quote',
		keyword: 'hljs-keyword',
		'selector-tag': 'hljs-selector-tag',
		subst: 'hljs-subst',
		literal: 'hljs-literal',
		number: 'hljs-number',
		symbol: 'hljs-symbol',
		string: 'hljs-string',
		doctag: 'hljs-doctag',
		regexp: 'hljs-regexp',
		title: 'hljs-title',
		section: 'hljs-section',
		name: 'hljs-name',
		'selector-id': 'hljs-selector-id',
		'selector-class': 'hljs-selector-class',
		attribute: 'hljs-attribute',
		attr: 'hljs-attr',
		property: 'hljs-property',
		variable: 'hljs-variable',
		'template-variable': 'hljs-template-variable',
		type: 'hljs-type',
		built_in: 'hljs-built_in',
		'builtin-name': 'hljs-builtin-name',
		meta: 'hljs-meta',
		link: 'hljs-link',
		deletion: 'hljs-deletion',
		addition: 'hljs-addition',
		emphasis: 'hljs-emphasis',
		strong: 'hljs-strong',
	},
	table: 'lexical-table',
	tableCell: 'lexical-table-cell',
	tableCellHeader: 'lexical-table-cell-header',
	tableRow: 'lexical-table-row',
};
