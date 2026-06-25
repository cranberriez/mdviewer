import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type RefObject,
  type UIEventHandler,
} from "react";
import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
} from "@lexical/markdown";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import {
  TableCellNode,
  TableNode,
  TableRowNode,
} from "@lexical/table";
import {
  $getRoot,
  type EditorState,
} from "lexical";
import {
  type MarkdownAction,
  type MarkdownActionResult,
} from "../markdownActions";
import { applyMarkdownActionToEditor } from "./lexical/applyAction";
import CodeBlockToolsPlugin from "./lexical/plugins/CodeBlockToolsPlugin";
import CodeHighlightPlugin from "./lexical/plugins/CodeHighlightPlugin";
import FloatingFormatToolbarPlugin from "./lexical/plugins/FloatingFormatToolbarPlugin";
import FloatingLinkEditorPlugin from "./lexical/plugins/FloatingLinkEditorPlugin";
import SlashCommandMenuPlugin from "./lexical/plugins/SlashCommandMenuPlugin";
import TableActionsPlugin from "./lexical/plugins/TableActionsPlugin";
import { lexicalTheme } from "./lexical/theme";
import { MARKDOWN_TRANSFORMERS } from "./lexical/transformers";

interface LexicalMarkdownEditorProps {
  content: string;
  onChange: (content: string) => void;
  onScroll: UIEventHandler<HTMLDivElement>;
  rootRef?: RefObject<HTMLDivElement | null>;
}

export interface LexicalMarkdownEditorHandle {
  applyAction: (action: MarkdownAction) => MarkdownActionResult | null;
  focus: () => void;
}

const EDITOR_NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  CodeHighlightNode,
  LinkNode,
  AutoLinkNode,
  TableNode,
  TableRowNode,
  TableCellNode,
  HorizontalRuleNode,
];

// Keep import and export symmetric with rendered Markdown semantics. Raw blank
// lines delimit blocks; they should not become editable empty paragraphs.
// Adjacent non-empty prose lines are soft wraps, so merge them on import. Fenced
// code contents stay intact because Lexical's normalizer preserves code blocks.
const PRESERVE_NEWLINES = false;
const MERGE_ADJACENT_LINES = true;

function $importMarkdown(markdown: string): void {
  // Normalise CRLF/CR to LF before import. Lexical's importer splits on "\n";
  // on Windows-saved files the leftover "\r" defeats the code-fence end regex
  // (/^[ \t]*`{3,}$/), so the closing ``` never matches and the whole block
  // falls through to per-line inline code. (Editor re-serialises with "\n".)
  const normalized = markdown.replace(/\r\n?/g, "\n");

  $convertFromMarkdownString(
    normalized,
    MARKDOWN_TRANSFORMERS,
    undefined,
    PRESERVE_NEWLINES,
    MERGE_ADJACENT_LINES,
  );
}

function $readMarkdown(): string {
  return $convertToMarkdownString(
    MARKDOWN_TRANSFORMERS,
    undefined,
    PRESERVE_NEWLINES,
  );
}

/**
 * Bridges the imperative handle (`applyAction`, `focus`) and external
 * `content` syncing to the Lexical editor instance. Lives inside
 * `LexicalComposer` so it can read the editor via context.
 */
const EditorBridge = forwardRef<
  LexicalMarkdownEditorHandle,
  {
    content: string;
    lastIngestedRef: RefObject<string>;
    lastEmittedRef: RefObject<string>;
  }
>(function EditorBridge({ content, lastIngestedRef, lastEmittedRef }, ref) {
  const [editor] = useLexicalComposerContext();

  // Push external content changes (file switches, toolbar undo/redo, edits made
  // in the code view) into the editor, but skip echoes of our own output.
  // We track two values: `lastIngestedRef` is the exact markdown string we last
  // imported (compared against the incoming prop), while `lastEmittedRef` is its
  // canonical re-serialization (compared against onChange output) — Lexical may
  // normalise spacing on round-trip, so the two can differ.
  useEffect(() => {
    if (content === lastIngestedRef.current) {
      return;
    }

    lastIngestedRef.current = content;
    editor.update(
      () => {
        $importMarkdown(content);
        lastEmittedRef.current = $readMarkdown();
      },
      { discrete: true },
    );
  }, [content, editor, lastIngestedRef, lastEmittedRef]);

  useImperativeHandle(
    ref,
    () => ({
      applyAction(action) {
        applyMarkdownActionToEditor(editor, action);
        let nextContent = "";
        editor.read(() => {
          nextContent = $readMarkdown();
        });
        const cursor = nextContent.length;
        return { content: nextContent, selection: { start: cursor, end: cursor } };
      },
      focus() {
        editor.focus();
      },
    }),
    [editor],
  );

  return null;
});

export const LexicalMarkdownEditor = forwardRef<
  LexicalMarkdownEditorHandle,
  LexicalMarkdownEditorProps
>(function LexicalMarkdownEditor(
  { content, onChange, onScroll, rootRef },
  ref,
) {
  const lastIngestedRef = useRef<string>(content);
  const lastEmittedRef = useRef<string>(content);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const setRootRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (rootRef) {
        rootRef.current = node;
      }
    },
    [rootRef],
  );

  const initialConfig = useRef({
    namespace: "mdviewer-editor",
    theme: lexicalTheme,
    nodes: EDITOR_NODES,
    editorState: () => $importMarkdown(content),
    onError(error: Error) {
      // Surface in dev tools; never let a transform error tear down the app.
      console.error("[LexicalMarkdownEditor]", error);
    },
  }).current;

  const handleChange = useCallback((editorState: EditorState) => {
    editorState.read(() => {
      // Guard against the brief empty state during programmatic reloads.
      const root = $getRoot();
      if (root.getChildrenSize() === 0) {
        return;
      }

      // Skip echoes of content we just ingested/emitted to avoid feedback loops.
      const markdown = $readMarkdown();
      if (markdown === lastEmittedRef.current) {
        return;
      }

      // This is a genuine user edit: keep both guards current so the value we
      // hand back to App isn't re-imported on the next render.
      lastEmittedRef.current = markdown;
      lastIngestedRef.current = markdown;
      onChangeRef.current(markdown);
    });
  }, []);

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div
        ref={setRootRef}
        className="lexical-editor-shell"
        data-find-content="true"
        onScroll={onScroll}
      >
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className="preview-inner md lexical-content"
              aria-label="Markdown editor"
              aria-multiline="true"
              role="textbox"
              spellCheck={false}
            />
          }
          placeholder={
            <div className="lexical-placeholder">Start writing markdown…</div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <ListPlugin />
        <CheckListPlugin />
        <LinkPlugin />
        <TablePlugin />
        <TableActionsPlugin />
        <FloatingFormatToolbarPlugin />
        <FloatingLinkEditorPlugin />
        <CodeHighlightPlugin />
        <CodeBlockToolsPlugin />
        <SlashCommandMenuPlugin />
        <TabIndentationPlugin />
        <MarkdownShortcutPlugin transformers={MARKDOWN_TRANSFORMERS} />
        <OnChangePlugin
          onChange={handleChange}
          ignoreHistoryMergeTagChange
          ignoreSelectionChange
        />
        <EditorBridge
          ref={ref}
          content={content}
          lastIngestedRef={lastIngestedRef}
          lastEmittedRef={lastEmittedRef}
        />
      </div>
    </LexicalComposer>
  );
});
