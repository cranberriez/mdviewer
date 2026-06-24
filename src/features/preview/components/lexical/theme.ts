import type { EditorThemeClasses } from "lexical";

/**
 * Lexical applies these class names to the DOM it renders. We keep them
 * namespaced under `lexical-*` and style them in `lexical.css`, while leaning
 * on the existing `.md` element styles (h1, p, ul, code, …) for the bulk of
 * the look so the editor matches the preview pane.
 */
export const lexicalTheme: EditorThemeClasses = {
  paragraph: "lexical-paragraph",
  quote: "lexical-quote",
  heading: {
    h1: "lexical-h1",
    h2: "lexical-h2",
    h3: "lexical-h3",
    h4: "lexical-h4",
    h5: "lexical-h5",
    h6: "lexical-h6",
  },
  list: {
    nested: {
      listitem: "lexical-nested-listitem",
    },
    ol: "lexical-ol",
    ul: "lexical-ul",
    listitem: "lexical-listitem",
    listitemChecked: "lexical-listitem-checked",
    listitemUnchecked: "lexical-listitem-unchecked",
    checklist: "lexical-checklist",
  },
  link: "lexical-link",
  text: {
    bold: "lexical-text-bold",
    italic: "lexical-text-italic",
    strikethrough: "lexical-text-strikethrough",
    underline: "lexical-text-underline",
    code: "lexical-text-code",
  },
  code: "lexical-code",
  codeHighlight: {
    atrule: "lexical-token-attr",
    attr: "lexical-token-attr",
    boolean: "lexical-token-property",
    builtin: "lexical-token-selector",
    cdata: "lexical-token-comment",
    char: "lexical-token-selector",
    class: "lexical-token-function",
    "class-name": "lexical-token-function",
    comment: "lexical-token-comment",
    constant: "lexical-token-property",
    deleted: "lexical-token-property",
    doctype: "lexical-token-comment",
    entity: "lexical-token-operator",
    function: "lexical-token-function",
    important: "lexical-token-variable",
    inserted: "lexical-token-selector",
    keyword: "lexical-token-attr",
    namespace: "lexical-token-variable",
    number: "lexical-token-property",
    operator: "lexical-token-operator",
    prolog: "lexical-token-comment",
    property: "lexical-token-property",
    punctuation: "lexical-token-punctuation",
    regex: "lexical-token-variable",
    selector: "lexical-token-selector",
    string: "lexical-token-selector",
    symbol: "lexical-token-property",
    tag: "lexical-token-property",
    url: "lexical-token-operator",
    variable: "lexical-token-variable",
  },
  table: "lexical-table",
  tableCell: "lexical-table-cell",
  tableCellHeader: "lexical-table-cell-header",
  tableRow: "lexical-table-row",
};
