export type MarkdownAction =
  | "bold"
  | "italic"
  | "strike"
  | "heading"
  | "link"
  | "image"
  | "inlineCode"
  | "codeBlock"
  | "quote"
  | "bulletList"
  | "numberedList"
  | "checkList"
  | "table";

export interface MarkdownSelection {
  start: number;
  end: number;
}

export interface MarkdownActionResult {
  content: string;
  selection: MarkdownSelection;
}

function lineStart(value: string, index: number) {
  return value.lastIndexOf("\n", Math.max(0, index - 1)) + 1;
}

function lineEnd(value: string, index: number) {
  const nextBreak = value.indexOf("\n", index);
  return nextBreak === -1 ? value.length : nextBreak;
}

function withWrappedSelection(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
): MarkdownActionResult {
  const selected = value.slice(start, end);
  const content =
    value.slice(0, start) + before + selected + after + value.slice(end);

  if (selected.length === 0) {
    const cursor = start + before.length;
    return { content, selection: { start: cursor, end: cursor } };
  }

  return {
    content,
    selection: {
      start: start + before.length,
      end: start + before.length + selected.length,
    },
  };
}

function withLinePrefixes(
  value: string,
  start: number,
  end: number,
  prefix: string,
): MarkdownActionResult {
  const from = lineStart(value, start);
  const to = lineEnd(value, Math.max(start, end));
  const selected = value.slice(from, to);
  const lines = selected.length === 0 ? [""] : selected.split("\n");
  const replacement = lines.map((line) => `${prefix}${line}`).join("\n");
  const content = value.slice(0, from) + replacement + value.slice(to);
  const cursor = start + prefix.length;

  return {
    content,
    selection: {
      start: cursor,
      end: end + prefix.length * lines.length,
    },
  };
}

function insertSnippet(
  value: string,
  start: number,
  end: number,
  snippet: string,
  selectionStart: number,
  selectionEnd = selectionStart,
): MarkdownActionResult {
  const content = value.slice(0, start) + snippet + value.slice(end);

  return {
    content,
    selection: {
      start: start + selectionStart,
      end: start + selectionEnd,
    },
  };
}

export function applyMarkdownAction(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  action: MarkdownAction,
): MarkdownActionResult {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);
  const selected = value.slice(start, end);

  switch (action) {
    case "bold":
      return withWrappedSelection(value, start, end, "**", "**");
    case "italic":
      return withWrappedSelection(value, start, end, "*", "*");
    case "strike":
      return withWrappedSelection(value, start, end, "~~", "~~");
    case "inlineCode":
      return withWrappedSelection(value, start, end, "`", "`");
    case "heading":
      return withLinePrefixes(value, start, end, "# ");
    case "quote":
      return withLinePrefixes(value, start, end, "> ");
    case "bulletList":
      return withLinePrefixes(value, start, end, "- ");
    case "numberedList":
      return withLinePrefixes(value, start, end, "1. ");
    case "checkList":
      return withLinePrefixes(value, start, end, "- [ ] ");
    case "link": {
      const label = selected || "text";
      const snippet = `[${label}](url)`;
      const labelStart = 1;
      return insertSnippet(
        value,
        start,
        end,
        snippet,
        selected ? snippet.length : labelStart,
        selected ? snippet.length : labelStart + label.length,
      );
    }
    case "image": {
      const label = selected || "alt";
      const snippet = `![${label}](url)`;
      const labelStart = 2;
      return insertSnippet(
        value,
        start,
        end,
        snippet,
        selected ? snippet.length : labelStart,
        selected ? snippet.length : labelStart + label.length,
      );
    }
    case "codeBlock": {
      const body = selected || "code";
      const snippet = `\`\`\`\n${body}\n\`\`\``;
      return insertSnippet(
        value,
        start,
        end,
        snippet,
        4,
        4 + body.length,
      );
    }
    case "table": {
      const snippet = "\n| Col | Col |\n| --- | --- |\n| a | b |\n";
      return insertSnippet(value, start, end, snippet, 3, 6);
    }
  }
}
