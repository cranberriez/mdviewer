// Serialize a selection from the rendered preview back into Markdown source so
// that copying from the read-only preview preserves the syntax symbols
// (`**bold**`, `# heading`, `` `code` ``, `- list`, …) rather than the styled
// plain text the browser would otherwise put on the clipboard.
//
// This is a pragmatic, structural serializer over the subset of HTML our
// markdown-it config emits — not a general HTML→Markdown converter. It walks the
// DOM nodes of the selected fragment and re-emits Markdown per element type.

function escapeInline(text: string): string {
  // Escape the characters that would otherwise be interpreted as Markdown when
  // they appear in copied literal text.
  return text.replace(/([\\`*_{}\[\]()#+\-.!])/g, "\\$1");
}

// Inline serialization: text + emphasis/code/links/images within a block.
function serializeInline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeInline(node.nodeValue ?? "");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const inner = () =>
    Array.from(el.childNodes).map(serializeInline).join("");

  switch (tag) {
    case "strong":
    case "b":
      return `**${inner()}**`;
    case "em":
    case "i":
      return `*${inner()}*`;
    case "del":
    case "s":
    case "strike":
      return `~~${inner()}~~`;
    case "code":
      // Inline code — use the raw text content (no inner escaping inside code).
      return `\`${el.textContent ?? ""}\``;
    case "a": {
      const href = el.getAttribute("href") ?? "";
      const label = inner() || (el.textContent ?? "");
      return href ? `[${label}](${href})` : label;
    }
    case "img": {
      const src = el.getAttribute("src") ?? "";
      const alt = el.getAttribute("alt") ?? "";
      return `![${alt}](${src})`;
    }
    case "br":
      return "\n";
    default:
      return inner();
  }
}

function repeat(text: string, count: number): string {
  return count > 0 ? text.repeat(count) : "";
}

// Block-level serialization: headings, paragraphs, lists, quotes, code blocks,
// rules, tables. `depth` tracks list nesting for indentation.
function serializeBlock(node: Node, depth: number): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.nodeValue ?? "").trim();
    return text ? escapeInline(text) : "";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const inlineContent = () =>
    Array.from(el.childNodes).map(serializeInline).join("").trim();

  switch (tag) {
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6": {
      const level = Number(tag[1]);
      return `${repeat("#", level)} ${inlineContent()}`;
    }
    case "p":
      return inlineContent();
    case "blockquote": {
      const inner = serializeChildren(el, depth);
      return inner
        .split("\n")
        .map((line) => (line ? `> ${line}` : ">"))
        .join("\n");
    }
    case "pre": {
      // Fenced code block — emit the raw text verbatim, with the language hint
      // recovered from the highlight.js class if present.
      const codeEl = el.querySelector("code");
      const text = (codeEl ?? el).textContent ?? "";
      const langClass = codeEl?.className.match(/language-([\w-]+)/);
      const lang = langClass ? langClass[1] : "";
      return `\`\`\`${lang}\n${text.replace(/\n$/, "")}\n\`\`\``;
    }
    case "ul":
    case "ol": {
      const ordered = tag === "ol";
      const items = Array.from(el.children).filter(
        (child) => child.tagName.toLowerCase() === "li",
      );
      return items
        .map((li, index) => serializeListItem(li as HTMLElement, ordered, index, depth))
        .join("\n");
    }
    case "hr":
      return "---";
    case "table":
      return serializeTable(el);
    case "li":
      // Handled by the parent list; fall through to inline if reached directly.
      return inlineContent();
    default: {
      // Container we don't special-case (e.g. a wrapping div) — serialize its
      // block children.
      const blockChildren = Array.from(el.children).some((child) =>
        isBlock(child.tagName.toLowerCase()),
      );
      return blockChildren ? serializeChildren(el, depth) : inlineContent();
    }
  }
}

const BLOCK_TAGS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "blockquote", "pre", "ul", "ol", "li", "hr", "table", "div",
]);

function isBlock(tag: string): boolean {
  return BLOCK_TAGS.has(tag);
}

function serializeListItem(
  li: HTMLElement,
  ordered: boolean,
  index: number,
  depth: number,
): string {
  const indent = repeat("  ", depth);
  // Task-list checkbox, if present.
  const checkbox = li.querySelector('input[type="checkbox"]');
  const taskPrefix = checkbox
    ? (checkbox as HTMLInputElement).checked
      ? "[x] "
      : "[ ] "
    : "";

  // Inline portion of the item (text before any nested list).
  const inlineParts: string[] = [];
  const nestedBlocks: string[] = [];
  li.childNodes.forEach((child) => {
    if (
      child.nodeType === Node.ELEMENT_NODE &&
      ["ul", "ol"].includes((child as HTMLElement).tagName.toLowerCase())
    ) {
      nestedBlocks.push(serializeBlock(child, depth + 1));
    } else if (
      child.nodeType === Node.ELEMENT_NODE &&
      (child as HTMLElement).tagName.toLowerCase() === "input"
    ) {
      // Checkbox already captured as the task prefix.
    } else {
      inlineParts.push(serializeInline(child));
    }
  });

  const marker = ordered ? `${index + 1}.` : "-";
  const text = inlineParts.join("").trim();
  const line = `${indent}${marker} ${taskPrefix}${text}`.replace(/\s+$/, "");
  return nestedBlocks.length ? `${line}\n${nestedBlocks.join("\n")}` : line;
}

function serializeTable(table: HTMLElement): string {
  const rows = Array.from(table.querySelectorAll("tr"));
  if (rows.length === 0) {
    return "";
  }

  const cellText = (cell: Element) =>
    Array.from(cell.childNodes).map(serializeInline).join("").trim();

  const lines: string[] = [];
  let headerEmitted = false;

  rows.forEach((row) => {
    const cells = Array.from(row.children).filter((child) =>
      ["td", "th"].includes(child.tagName.toLowerCase()),
    );
    if (cells.length === 0) {
      return;
    }
    lines.push(`| ${cells.map(cellText).join(" | ")} |`);
    if (!headerEmitted) {
      lines.push(`| ${cells.map(() => "---").join(" | ")} |`);
      headerEmitted = true;
    }
  });

  return lines.join("\n");
}

// Serialize the block-level children of a container, separating blocks with a
// blank line (the standard Markdown paragraph gap).
function serializeChildren(container: Node, depth: number): string {
  const parts: string[] = [];
  container.childNodes.forEach((child) => {
    const serialized = serializeBlock(child, depth);
    if (serialized.trim()) {
      parts.push(serialized);
    }
  });
  return parts.join("\n\n");
}

/**
 * Convert a selection Range from the rendered preview into Markdown source.
 * Returns an empty string when the selection is empty.
 */
export function rangeToMarkdown(range: Range): string {
  if (range.collapsed) {
    return "";
  }

  const fragment = range.cloneContents();
  // A wrapper so we can treat the fragment uniformly as a container.
  const wrapper = document.createElement("div");
  wrapper.appendChild(fragment);

  // If the fragment contains block-level structure, serialize as blocks;
  // otherwise treat it as an inline run (a partial selection within a paragraph).
  const hasBlocks = Array.from(wrapper.children).some((child) =>
    isBlock(child.tagName.toLowerCase()),
  );

  const markdown = hasBlocks
    ? serializeChildren(wrapper, 0)
    : Array.from(wrapper.childNodes).map(serializeInline).join("");

  return markdown.replace(/\n{3,}/g, "\n\n").trim();
}
