import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type FormEvent,
  type KeyboardEvent,
  type ChangeEvent,
  type UIEventHandler,
} from "react";
import {
  type MarkdownAction,
  type MarkdownActionResult,
} from "../markdownActions";

interface VisualMarkdownEditorProps {
  content: string;
  html: string;
  onChange: (content: string) => void;
  onScroll: UIEventHandler<HTMLDivElement>;
}

export interface VisualMarkdownEditorHandle {
  applyAction: (action: MarkdownAction) => MarkdownActionResult | null;
  focus: () => void;
}

function escapeTableCell(value: string) {
  return value.replace(/\|/g, "\\|").trim();
}

function serializeInline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (!(node instanceof HTMLElement)) {
    return Array.from(node.childNodes).map(serializeInline).join("");
  }

  const body = Array.from(node.childNodes).map(serializeInline).join("");
  const tag = node.tagName.toLowerCase();

  if (tag === "br") {
    return "\n";
  }

  if (tag === "strong" || tag === "b") {
    return `**${body}**`;
  }

  if (tag === "em" || tag === "i") {
    return `*${body}*`;
  }

  if (tag === "del" || tag === "s") {
    return `~~${body}~~`;
  }

  if (tag === "code" && node.parentElement?.tagName.toLowerCase() !== "pre") {
    return `\`${node.textContent ?? ""}\``;
  }

  if (tag === "a") {
    return `[${body}](${node.getAttribute("href") ?? ""})`;
  }

  if (tag === "img") {
    return `![${node.getAttribute("alt") ?? ""}](${node.getAttribute("src") ?? ""})`;
  }

  return body;
}

function isListElement(node: Node) {
  return (
    node instanceof HTMLElement &&
    ["ul", "ol"].includes(node.tagName.toLowerCase())
  );
}

function directChildCheckbox(element: HTMLElement) {
  return Array.from(element.children).find(
    (child): child is HTMLInputElement =>
      child instanceof HTMLInputElement && child.type === "checkbox",
  );
}

function serializeListItemInline(element: HTMLElement) {
  return Array.from(element.childNodes)
    .filter((child) => child !== directChildCheckbox(element) && !isListElement(child))
    .map(serializeInline)
    .join("")
    .trim();
}

function indentNestedList(value: string) {
  return value
    .trimEnd()
    .split("\n")
    .map((line) => (line ? `  ${line}` : line))
    .join("\n");
}

function serializeBlock(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (!(node instanceof HTMLElement)) {
    return Array.from(node.childNodes).map(serializeBlock).join("");
  }

  const tag = node.tagName.toLowerCase();

  if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4") {
    const level = Number(tag.slice(1));
    return `${"#".repeat(level)} ${serializeInline(node).trim()}\n\n`;
  }

  if (tag === "p" || tag === "div") {
    return `${serializeInline(node).trimEnd()}\n\n`;
  }

  if (tag === "blockquote") {
    const quote = serializeInline(node)
      .trim()
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
    return `${quote}\n\n`;
  }

  if (tag === "pre") {
    return `\`\`\`\n${node.textContent?.replace(/\n$/, "") ?? ""}\n\`\`\`\n\n`;
  }

  if (tag === "ul" || tag === "ol") {
    const ordered = tag === "ol";
    const items = Array.from(node.children)
      .filter((child) => child.tagName.toLowerCase() === "li")
      .map((child, index) => {
        const checkbox = directChildCheckbox(child as HTMLElement);
        const prefix = checkbox
          ? `- [${checkbox.checked ? "x" : " "}] `
          : ordered
            ? `${index + 1}. `
            : "- ";
        const nestedLists = Array.from(child.children)
          .filter(isListElement)
          .map((list) => indentNestedList(serializeBlock(list)));
        return [`${prefix}${serializeListItemInline(child as HTMLElement)}`, ...nestedLists]
          .filter(Boolean)
          .join("\n");
      });
    return `${items.join("\n")}\n\n`;
  }

  if (tag === "table") {
    const rows = Array.from(node.querySelectorAll("tr")).map((row) =>
      Array.from(row.children).map((cell) => escapeTableCell(serializeInline(cell))),
    );
    const [head, ...body] = rows;
    if (!head) {
      return "";
    }

    return [
      `| ${head.join(" | ")} |`,
      `| ${head.map(() => "---").join(" | ")} |`,
      ...body.map((row) => `| ${row.join(" | ")} |`),
      "",
      "",
    ].join("\n");
  }

  if (tag === "hr") {
    return "---\n\n";
  }

  return Array.from(node.childNodes).map(serializeBlock).join("");
}

function serializeEditor(element: HTMLElement) {
  return Array.from(element.childNodes)
    .map(serializeBlock)
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

function enableEditorCheckboxes(element: HTMLElement) {
  element
    .querySelectorAll<HTMLInputElement>("input[type='checkbox']")
    .forEach((checkbox) => {
      checkbox.checked = checkbox.hasAttribute("checked");
      checkbox.defaultChecked = checkbox.checked;
      checkbox.contentEditable = "false";
      checkbox.disabled = false;
    });
}

function selectionInside(element: HTMLElement) {
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

function collapsedSelectionInside(element: HTMLElement) {
  const currentSelection = selectionInside(element);
  if (!currentSelection || !currentSelection.range.collapsed) {
    return null;
  }

  return currentSelection.range;
}

function selectNodeContents(node: Node) {
  const range = document.createRange();
  range.selectNodeContents(node);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function placeCaretAfterNode(node: Node) {
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function placeCaretInTextNode(node: Text, offset = node.data.length) {
  const range = document.createRange();
  range.setStart(node, Math.max(0, Math.min(offset, node.data.length)));
  range.collapse(true);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function placeCaretAfter(node: Node) {
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function textNodeAtCaret(range: Range) {
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

function hasAncestor(node: Node, tags: string[]) {
  let current: Node | null = node.parentNode;
  const tagSet = new Set(tags.map((tag) => tag.toLowerCase()));

  while (current) {
    if (
      current instanceof HTMLElement &&
      tagSet.has(current.tagName.toLowerCase())
    ) {
      return true;
    }

    current = current.parentNode;
  }

  return false;
}

function closestAncestor(node: Node, tagName: string, root: HTMLElement) {
  let current: Node | null =
    node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode;
  const normalized = tagName.toLowerCase();

  while (current && current !== root) {
    if (
      current instanceof HTMLElement &&
      current.tagName.toLowerCase() === normalized
    ) {
      return current;
    }

    current = current.parentNode;
  }

  return null;
}

function placeCaretAtEnd(element: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function selectedTextFromRange(range: Range) {
  return range.toString();
}

function replaceTextRangeWithNodes(
  textNode: Text,
  start: number,
  end: number,
  nodes: Node[],
  caretNode?: Text,
  caretOffset?: number,
) {
  const parent = textNode.parentNode;
  if (!parent) {
    return false;
  }

  const value = textNode.data;
  const before = value.slice(0, start);
  const after = value.slice(end);
  const anchor = textNode.nextSibling;

  textNode.data = before;

  for (const node of nodes) {
    parent.insertBefore(node, anchor);
  }

  if (after) {
    parent.insertBefore(document.createTextNode(after), anchor);
  }

  if (caretNode) {
    placeCaretInTextNode(caretNode, caretOffset);
  } else {
    placeCaretAfterNode(nodes[nodes.length - 1]);
  }

  return true;
}

function findEditableBlock(node: Node, root: HTMLElement) {
  let current: Node | null =
    node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode;

  while (current && current !== root) {
    if (current instanceof HTMLElement) {
      const tag = current.tagName.toLowerCase();
      if (
        [
          "h1",
          "h2",
          "h3",
          "h4",
          "p",
          "div",
          "blockquote",
          "li",
          "pre",
        ].includes(tag)
      ) {
        return current;
      }
    }

    current = current.parentNode;
  }

  return root;
}

function blockTextBeforeCaret(block: HTMLElement, range: Range) {
  const blockRange = document.createRange();
  blockRange.selectNodeContents(block);
  blockRange.setEnd(range.startContainer, range.startOffset);
  return blockRange.toString();
}

function replaceBlockWithElement(
  block: HTMLElement,
  element: HTMLElement,
  selectedNode?: Node,
) {
  if (block.isContentEditable && block.classList.contains("visual-markdown-editor")) {
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

function inlineAutoFormatBeforeInput(editor: HTMLElement, data: string) {
  const range = collapsedSelectionInside(editor);
  if (!range) {
    return false;
  }

  const caret = textNodeAtCaret(range);
  if (!caret || hasAncestor(caret.node, ["code", "pre", "a"])) {
    return false;
  }

  const beforeCaret = caret.node.data.slice(0, caret.offset);
  const candidate = beforeCaret + data;
  const patterns: Array<{
    regex: RegExp;
    tagName: string;
    trailingSpace?: boolean;
  }> = [
    { regex: /(^|[\s([{])\*\*([^*\n]+)\*\*$/, tagName: "strong" },
    { regex: /(^|[\s([{])__([^_\n]+)__$/, tagName: "strong" },
    { regex: /(^|[\s([{])`([^`\n]+)`$/, tagName: "code", trailingSpace: true },
    { regex: /(^|[\s([{])\*([^*\n]+)\*$/, tagName: "em" },
    { regex: /(^|[\s([{])_([^_\n]+)_$/, tagName: "em" },
  ];

  for (const pattern of patterns) {
    const match = candidate.match(pattern.regex);
    if (!match || match.index === undefined) {
      continue;
    }

    const matchStart = match.index + match[1].length;
    const element = document.createElement(pattern.tagName);
    const text = document.createTextNode(match[2]);
    const insertedNodes: Node[] = [element];

    element.append(text);

    let caretNode: Text | undefined;
    let caretOffset: number | undefined;
    if (pattern.trailingSpace) {
      caretNode = document.createTextNode(" ");
      caretOffset = 1;
      insertedNodes.push(caretNode);
    }

    return replaceTextRangeWithNodes(
      caret.node,
      matchStart,
      caret.offset,
      insertedNodes,
      caretNode,
      caretOffset,
    );
  }

  return false;
}

function blockAutoFormatBeforeInput(editor: HTMLElement, data: string) {
  const range = collapsedSelectionInside(editor);
  if (!range) {
    return false;
  }

  const block = findEditableBlock(range.startContainer, editor);
  const blockTag = block?.tagName.toLowerCase();
  if (!block || blockTag === "pre" || hasAncestor(block, ["code", "pre"])) {
    return false;
  }

  const beforeCaret = blockTextBeforeCaret(block, range);
  const fullText = block.textContent ?? "";

  if (data === " ") {
    if (beforeCaret === "#") {
      const heading = document.createElement("h1");
      const text = document.createTextNode(fullText.slice(1));
      heading.append(text);
      replaceBlockWithElement(block, heading, text);
      return true;
    }

    if (beforeCaret === "##") {
      const heading = document.createElement("h2");
      const text = document.createTextNode(fullText.slice(2));
      heading.append(text);
      replaceBlockWithElement(block, heading, text);
      return true;
    }

    if (beforeCaret === "###") {
      const heading = document.createElement("h3");
      const text = document.createTextNode(fullText.slice(3));
      heading.append(text);
      replaceBlockWithElement(block, heading, text);
      return true;
    }

    if (beforeCaret === ">") {
      const quote = document.createElement("blockquote");
      const text = document.createTextNode(fullText.slice(1));
      quote.append(text);
      replaceBlockWithElement(block, quote, text);
      return true;
    }

    if (beforeCaret === "-" || beforeCaret === "*") {
      const list = document.createElement("ul");
      const item = document.createElement("li");
      const text = document.createTextNode(fullText.slice(1));
      item.append(text);
      list.append(item);
      replaceBlockWithElement(block, list, text);
      return true;
    }

    if (beforeCaret === "1.") {
      const list = document.createElement("ol");
      const item = document.createElement("li");
      const text = document.createTextNode(fullText.slice(2));
      item.append(text);
      list.append(item);
      replaceBlockWithElement(block, list, text);
      return true;
    }

    if (beforeCaret === "- [ ]" || beforeCaret === "- [x]") {
      const list = document.createElement("ul");
      const item = document.createElement("li");
      const checkbox = document.createElement("input");
      const text = document.createTextNode(fullText.slice(5));

      list.className = "contains-task-list";
      item.className = "task-list-item";
      checkbox.className = "task-list-item-checkbox";
      checkbox.type = "checkbox";
      checkbox.contentEditable = "false";
      checkbox.checked = beforeCaret === "- [x]";
      item.append(checkbox, " ", text);
      list.append(item);
      replaceBlockWithElement(block, list, text);
      return true;
    }
  }

  if (data === "`" && beforeCaret === "``") {
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    const text = document.createTextNode(fullText.slice(2));
    code.append(text);
    pre.append(code);
    replaceBlockWithElement(block, pre, text);
    return true;
  }

  return false;
}

function autoFormatBeforeInput(editor: HTMLElement, data: string) {
  return (
    blockAutoFormatBeforeInput(editor, data) ||
    inlineAutoFormatBeforeInput(editor, data)
  );
}

function paragraphWithBreak() {
  const paragraph = document.createElement("p");
  const spacer = document.createElement("br");
  paragraph.append(spacer);
  return paragraph;
}

function escapeCodeBlock(editor: HTMLElement) {
  const range = collapsedSelectionInside(editor);
  if (!range) {
    return false;
  }

  const pre = closestAncestor(range.startContainer, "pre", editor);
  if (!pre) {
    return false;
  }

  const paragraph = paragraphWithBreak();
  pre.insertAdjacentElement("afterend", paragraph);
  placeCaretAtEnd(paragraph);
  return true;
}

function deleteEmptyCodeAtCaret(editor: HTMLElement) {
  const range = collapsedSelectionInside(editor);
  if (!range) {
    return false;
  }

  const inlineCode = closestAncestor(range.startContainer, "code", editor);
  const pre = closestAncestor(range.startContainer, "pre", editor);

  if (inlineCode && !pre && (inlineCode.textContent ?? "").length === 0) {
    const next = inlineCode.nextSibling;
    inlineCode.remove();

    if (next?.nodeType === Node.TEXT_NODE) {
      placeCaretInTextNode(next as Text, 0);
    } else {
      placeCaretAtEnd(editor);
    }

    return true;
  }

  if (pre && (pre.textContent ?? "").length === 0) {
    const paragraph = paragraphWithBreak();
    pre.replaceWith(paragraph);
    placeCaretAtEnd(paragraph);
    return true;
  }

  return false;
}

function insertElementAtRange(
  range: Range,
  element: HTMLElement,
  selectedNode?: Node,
) {
  range.deleteContents();
  range.insertNode(element);

  if (selectedNode) {
    selectNodeContents(selectedNode);
  } else {
    placeCaretAfter(element);
  }
}

function insertInlineElement(
  range: Range,
  tagName: string,
  fallbackText: string,
) {
  const element = document.createElement(tagName);
  const text = document.createTextNode(selectedTextFromRange(range) || fallbackText);
  element.append(text);

  if (tagName.toLowerCase() === "code") {
    const trailingSpace = document.createTextNode(" ");
    range.deleteContents();
    range.insertNode(element);
    element.parentNode?.insertBefore(trailingSpace, element.nextSibling);
    placeCaretInTextNode(trailingSpace);
    return;
  }

  insertElementAtRange(range, element, text);
}

function insertLink(range: Range) {
  const anchor = document.createElement("a");
  anchor.href = "url";
  const text = document.createTextNode(selectedTextFromRange(range) || "text");
  anchor.append(text);
  insertElementAtRange(range, anchor, text);
}

function insertImage(range: Range) {
  const image = document.createElement("img");
  image.alt = selectedTextFromRange(range) || "alt";
  image.src = "url";
  insertElementAtRange(range, image);
}

function insertCodeBlock(range: Range) {
  const pre = document.createElement("pre");
  const code = document.createElement("code");
  const text = document.createTextNode(selectedTextFromRange(range) || "code");
  code.append(text);
  pre.append(code);
  insertElementAtRange(range, pre, text);
}

function insertChecklist(range: Range) {
  const selected = selectedTextFromRange(range);
  const lines = (selected || "Task")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const list = document.createElement("ul");
  let selectedNode: Node | undefined;

  list.className = "contains-task-list";
  for (const line of lines) {
    const item = document.createElement("li");
    const checkbox = document.createElement("input");
    const text = document.createTextNode(line);

    item.className = "task-list-item";
    checkbox.className = "task-list-item-checkbox";
    checkbox.type = "checkbox";
    checkbox.contentEditable = "false";
    item.append(checkbox, " ", text);
    list.append(item);
    selectedNode ??= text;
  }

  insertElementAtRange(range, list, selectedNode);
}

function insertTable(range: Range) {
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");
  const headRow = document.createElement("tr");
  const bodyRow = document.createElement("tr");
  let firstCellText: Text | undefined;

  for (const label of ["Col", "Col"]) {
    const cell = document.createElement("th");
    const text = document.createTextNode(label);
    firstCellText ??= text;
    cell.append(text);
    headRow.append(cell);
  }

  for (const label of ["a", "b"]) {
    const cell = document.createElement("td");
    cell.append(document.createTextNode(label));
    bodyRow.append(cell);
  }

  thead.append(headRow);
  tbody.append(bodyRow);
  table.append(thead, tbody);
  insertElementAtRange(range, table, firstCellText);
}

export const VisualMarkdownEditor = forwardRef<
  VisualMarkdownEditorHandle,
  VisualMarkdownEditorProps
>(function VisualMarkdownEditor({ content, html, onChange, onScroll }, ref) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const focusedRef = useRef(false);
  const lastSyncedContentRef = useRef(content);

  const syncHtml = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    editor.innerHTML = html;
    enableEditorCheckboxes(editor);
    lastSyncedContentRef.current = content;
  }, [content, html]);

  useEffect(() => {
    if (focusedRef.current && lastSyncedContentRef.current === content) {
      return;
    }

    syncHtml();
  }, [content, syncHtml]);

  const commitDom = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      return "";
    }

    const nextContent = serializeEditor(editor);
    const previousContent = lastSyncedContentRef.current;
    lastSyncedContentRef.current = nextContent;

    if (nextContent !== previousContent) {
      onChange(nextContent);
    }

    return nextContent;
  }, [onChange]);

  useImperativeHandle(
    ref,
    () => ({
      applyAction(action) {
        const editor = editorRef.current;
        if (!editor) {
          return null;
        }

        const currentSelection = selectionInside(editor);
        if (!currentSelection) {
          editor.focus();
          placeCaretAtEnd(editor);
        }

        const range =
          currentSelection?.range ?? window.getSelection()?.getRangeAt(0) ?? null;

        if (!range) {
          return null;
        }

        if (action === "bold") {
          document.execCommand("bold");
        } else if (action === "italic") {
          document.execCommand("italic");
        } else if (action === "strike") {
          document.execCommand("strikeThrough");
        } else if (action === "heading") {
          document.execCommand("formatBlock", false, "h1");
        } else if (action === "quote") {
          document.execCommand("formatBlock", false, "blockquote");
        } else if (action === "bulletList") {
          document.execCommand("insertUnorderedList");
        } else if (action === "numberedList") {
          document.execCommand("insertOrderedList");
        } else if (action === "link") {
          if (range.collapsed) {
            insertLink(range);
          } else {
            document.execCommand("createLink", false, "url");
          }
        } else if (action === "inlineCode") {
          insertInlineElement(range, "code", "code");
        } else if (action === "image") {
          insertImage(range);
        } else if (action === "codeBlock") {
          insertCodeBlock(range);
        } else if (action === "checkList") {
          insertChecklist(range);
        } else if (action === "table") {
          insertTable(range);
        }

        const content = commitDom();
        const cursor = content.length;

        return { content, selection: { start: cursor, end: cursor } };
      },
      focus() {
        editorRef.current?.focus();
      },
    }),
    [commitDom],
  );

  const handleBeforeInput = useCallback(
    (event: FormEvent<HTMLDivElement>) => {
      const inputEvent = event.nativeEvent as InputEvent;
      const editor = editorRef.current;

      if (
        !editor ||
        inputEvent.inputType !== "insertText" ||
        !inputEvent.data
      ) {
        return;
      }

      if (autoFormatBeforeInput(editor, inputEvent.data)) {
        event.preventDefault();
        commitDom();
      }
    },
    [commitDom],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      if (event.key === "Enter" && event.shiftKey && escapeCodeBlock(editor)) {
        event.preventDefault();
        commitDom();
        return;
      }

      if (event.key === "Backspace" && deleteEmptyCodeAtCaret(editor)) {
        event.preventDefault();
        commitDom();
      }
    },
    [commitDom],
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLDivElement>) => {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.type === "checkbox") {
        commitDom();
      }
    },
    [commitDom],
  );

  return (
    <div
      ref={editorRef}
      className="preview-inner md visual-markdown-editor"
      contentEditable
      data-find-content="true"
      role="textbox"
      aria-label="Markdown editor"
      aria-multiline="true"
      spellCheck={false}
      suppressContentEditableWarning
      onBlur={() => {
        focusedRef.current = false;
        syncHtml();
      }}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBeforeInput={handleBeforeInput}
      onChange={handleChange}
      onInput={commitDom}
      onKeyDown={handleKeyDown}
      onScroll={onScroll}
    />
  );
});
