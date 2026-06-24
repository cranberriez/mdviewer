import { $createCodeNode } from "@lexical/code";
import {
  $isListNode,
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import { TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
} from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { INSERT_TABLE_COMMAND } from "@lexical/table";
import { $findMatchingParent } from "@lexical/utils";
import {
  $createParagraphNode,
  $createTextNode,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  type LexicalEditor,
  type TextFormatType,
} from "lexical";
import type { MarkdownAction } from "../../markdownActions";

function $blockTypeOfSelection(): string | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) {
    return null;
  }

  const anchorNode = selection.anchor.getNode();
  // A list item's "block" is its enclosing list, so prefer that when present.
  const list = $findMatchingParent(anchorNode, $isListNode);
  if ($isListNode(list)) {
    return list.getListType();
  }

  const target = anchorNode.getTopLevelElementOrThrow();
  if ($isHeadingNode(target)) {
    return target.getTag();
  }
  if ($isQuoteNode(target)) {
    return "quote";
  }
  return target.getType();
}

function $listSelectedIs(type: "bullet" | "number" | "check"): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) {
    return false;
  }
  const list = $findMatchingParent(selection.anchor.getNode(), $isListNode);
  return $isListNode(list) && list.getListType() === type;
}

function $toggleHeading() {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) {
    return;
  }
  const isH1 = $blockTypeOfSelection() === "h1";
  $setBlocksType(selection, () =>
    isH1 ? $createParagraphNode() : $createHeadingNode("h1"),
  );
}

function $toggleQuote() {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) {
    return;
  }
  const isQuote = $blockTypeOfSelection() === "quote";
  $setBlocksType(selection, () =>
    isQuote ? $createParagraphNode() : $createQuoteNode(),
  );
}

function $toggleCodeBlock() {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) {
    return;
  }
  const isCode = $blockTypeOfSelection() === "code";
  if (isCode) {
    $setBlocksType(selection, () => $createParagraphNode());
    return;
  }

  if (selection.isCollapsed()) {
    $setBlocksType(selection, () => $createCodeNode());
  } else {
    // Preserve the selected text inside the new code block.
    const text = selection.getTextContent();
    const codeNode = $createCodeNode();
    selection.insertNodes([codeNode]);
    codeNode.append($createTextNode(text));
  }
}

function $insertImage() {
  const selection = $getSelection();
  const alt = $isRangeSelection(selection)
    ? selection.getTextContent() || "alt"
    : "alt";
  // Images are markdown-only nodes here; insert raw markdown text that the
  // exporter round-trips and the importer would re-parse.
  $insertNodes([$createTextNode(`![${alt}](url)`)]);
}

/**
 * Apply a toolbar `MarkdownAction` to the live Lexical editor. Mirrors the
 * behaviour of the previous custom editor's `applyAction` so the existing
 * toolbar, keyboard wiring and undo/redo history keep working unchanged.
 */
export function applyMarkdownActionToEditor(
  editor: LexicalEditor,
  action: MarkdownAction,
): void {
  editor.focus();
  editor.update(() => {
    switch (action) {
      case "bold":
      case "italic":
      case "strike": {
        const format: TextFormatType =
          action === "bold"
            ? "bold"
            : action === "italic"
              ? "italic"
              : "strikethrough";
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
        return;
      }
      case "inlineCode": {
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code");
        return;
      }
      case "heading": {
        $toggleHeading();
        return;
      }
      case "quote": {
        $toggleQuote();
        return;
      }
      case "bulletList": {
        if ($listSelectedIs("bullet")) {
          editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
        } else {
          editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
        }
        return;
      }
      case "numberedList": {
        if ($listSelectedIs("number")) {
          editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
        } else {
          editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
        }
        return;
      }
      case "checkList": {
        if ($listSelectedIs("check")) {
          editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
        } else {
          editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
        }
        return;
      }
      case "link": {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, "url");
        return;
      }
      case "codeBlock": {
        $toggleCodeBlock();
        return;
      }
      case "image": {
        $insertImage();
        return;
      }
      case "table": {
        editor.dispatchCommand(INSERT_TABLE_COMMAND, {
          columns: "2",
          rows: "2",
          includeHeaders: true,
        });
        return;
      }
    }
  });
}
