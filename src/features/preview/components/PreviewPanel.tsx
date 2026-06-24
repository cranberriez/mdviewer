import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
  type UIEvent,
} from "react";
import type { FileViewMode } from "../../file-actions/components/FileActionControls";
import type { OpenFile } from "../../../shared/types/files";
import { parentPath } from "../../../shared/utils/path";
import { Notice } from "../../../shared/ui/components/Notice";
import {
  applyMarkdownAction,
  type MarkdownAction,
} from "../markdownActions";
import { EmptyPreview } from "./EmptyPreview";
import { MarkdownPreview } from "./MarkdownPreview";
import { PlainTextPreview } from "./PlainTextPreview";
import {
  LexicalMarkdownEditor,
  type LexicalMarkdownEditorHandle,
} from "./LexicalMarkdownEditor";

interface PreviewPanelProps {
  actionBar: ReactNode;
  error: string | null;
  findBar: ReactNode;
  findTargetRef: RefObject<HTMLElement | null>;
  mode: FileViewMode;
  openFile: OpenFile | null;
  onContentChange: (content: string) => void;
  onLinkClick: (href: string) => void;
  pendingFormatAction: { action: MarkdownAction; id: number } | null;
  renderedMarkdown: string;
}

type ScrollPanel = "editor" | "preview";

interface ToolbarHistoryEntry {
  before: string;
  after: string;
}

function clampScrollTop(scrollTop: number, element: HTMLElement) {
  return Math.max(0, Math.min(element.scrollHeight - element.clientHeight, scrollTop));
}

function scrollCenterRatio(element: HTMLElement) {
  if (element.scrollHeight <= element.clientHeight) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(1, (element.scrollTop + element.clientHeight / 2) / element.scrollHeight),
  );
}

export function PreviewPanel({
  actionBar,
  error,
  findBar,
  findTargetRef,
  mode,
  openFile,
  onContentChange,
  onLinkClick,
  pendingFormatAction,
  renderedMarkdown,
}: PreviewPanelProps) {
  const editorScrollRef = useRef<HTMLTextAreaElement | null>(null);
  const previewScrollRef = useRef<HTMLElement | null>(null);
  const visualEditorRootRef = useRef<HTMLDivElement | null>(null);
  const visualEditorRef = useRef<LexicalMarkdownEditorHandle | null>(null);
  const centerRatioRef = useRef(0);
  const ignoredScrollPanelRef = useRef<ScrollPanel | null>(null);
  const lastScrolledPanelRef = useRef<ScrollPanel>("preview");
  const appliedFormatActionIdRef = useRef(0);
  const undoStackRef = useRef<ToolbarHistoryEntry[]>([]);
  const redoStackRef = useRef<ToolbarHistoryEntry[]>([]);

  const setPreviewScrollRef = useCallback(
    (node: HTMLElement | null) => {
      previewScrollRef.current = node;
    },
    [],
  );

  useLayoutEffect(() => {
    if (!openFile) {
      findTargetRef.current = null;
      return;
    }

    if (mode === "code" || (mode === "edit" && openFile.kind !== "md")) {
      findTargetRef.current = editorScrollRef.current;
      return;
    }

    if (mode === "edit") {
      findTargetRef.current = visualEditorRootRef.current;
      return;
    }

    findTargetRef.current = previewScrollRef.current;
  }, [findTargetRef, mode, openFile]);

  const applyCenterRatio = useCallback((panel: ScrollPanel, ratio: number) => {
    const element =
      panel === "editor" ? editorScrollRef.current : previewScrollRef.current;

    if (!element || element.clientHeight === 0 || element.scrollHeight === 0) {
      return;
    }

    const nextScrollTop = clampScrollTop(
      ratio * element.scrollHeight - element.clientHeight / 2,
      element,
    );

    if (Math.abs(element.scrollTop - nextScrollTop) < 1) {
      return;
    }

    ignoredScrollPanelRef.current = panel;
    element.scrollTop = nextScrollTop;

    window.requestAnimationFrame(() => {
      if (ignoredScrollPanelRef.current === panel) {
        ignoredScrollPanelRef.current = null;
      }
    });
  }, []);

  const syncFromPanel = useCallback(
    (panel: ScrollPanel, element: HTMLElement) => {
      if (ignoredScrollPanelRef.current === panel) {
        ignoredScrollPanelRef.current = null;
        return;
      }

      const ratio = scrollCenterRatio(element);
      centerRatioRef.current = ratio;
      lastScrolledPanelRef.current = panel;
      applyCenterRatio(panel === "editor" ? "preview" : "editor", ratio);
    },
    [applyCenterRatio],
  );

  const handleEditorScroll = useCallback(
    (event: UIEvent<HTMLTextAreaElement>) => {
      syncFromPanel("editor", event.currentTarget);
    },
    [syncFromPanel],
  );

  const handlePreviewScroll = useCallback(
    (event: UIEvent<HTMLElement>) => {
      syncFromPanel("preview", event.currentTarget);
    },
    [syncFromPanel],
  );

  const handleEditorContentChange = useCallback(
    (content: string) => {
      if (editorScrollRef.current) {
        centerRatioRef.current = scrollCenterRatio(editorScrollRef.current);
        lastScrolledPanelRef.current = "editor";
      }

      onContentChange(content);
    },
    [onContentChange],
  );

  const focusActiveEditor = useCallback(() => {
    window.requestAnimationFrame(() => {
      if (mode === "edit" && openFile?.kind === "md") {
        visualEditorRef.current?.focus();
        return;
      }

      editorScrollRef.current?.focus();
    });
  }, [mode, openFile?.kind]);

  const pushToolbarHistory = useCallback((before: string, after: string) => {
    if (before === after) {
      return;
    }

    undoStackRef.current = [...undoStackRef.current, { before, after }].slice(-100);
    redoStackRef.current = [];
  }, []);

  const undoToolbarAction = useCallback(() => {
    const entry = undoStackRef.current[undoStackRef.current.length - 1];
    if (!entry) {
      return false;
    }

    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current, entry];
    onContentChange(entry.before);
    focusActiveEditor();
    return true;
  }, [focusActiveEditor, onContentChange]);

  const redoToolbarAction = useCallback(() => {
    const entry = redoStackRef.current[redoStackRef.current.length - 1];
    if (!entry) {
      return false;
    }

    redoStackRef.current = redoStackRef.current.slice(0, -1);
    undoStackRef.current = [...undoStackRef.current, entry];
    onContentChange(entry.after);
    focusActiveEditor();
    return true;
  }, [focusActiveEditor, onContentChange]);

  useEffect(() => {
    centerRatioRef.current = 0;
    ignoredScrollPanelRef.current = null;
    lastScrolledPanelRef.current = "preview";
    undoStackRef.current = [];
    redoStackRef.current = [];
  }, [openFile?.path]);

  useEffect(() => {
    if (!openFile || openFile.kind !== "md") {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;

      if (!modifier) {
        return;
      }

      if (key === "z") {
        if (event.shiftKey ? redoToolbarAction() : undoToolbarAction()) {
          event.preventDefault();
        }
      }

      if (key === "y" && redoToolbarAction()) {
        event.preventDefault();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openFile, redoToolbarAction, undoToolbarAction]);

  useEffect(() => {
    if (!openFile) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      applyCenterRatio("editor", centerRatioRef.current);
      applyCenterRatio("preview", centerRatioRef.current);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [applyCenterRatio, mode, openFile?.path]);

  useEffect(() => {
    if (!openFile || mode === "preview") {
      return;
    }

    const target = lastScrolledPanelRef.current === "editor" ? "preview" : "editor";
    const frame = window.requestAnimationFrame(() => {
      applyCenterRatio(target, centerRatioRef.current);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [applyCenterRatio, mode, openFile?.content, openFile?.path, renderedMarkdown]);

  useEffect(() => {
    if (
      !openFile ||
      openFile.kind !== "md" ||
      !pendingFormatAction ||
      appliedFormatActionIdRef.current === pendingFormatAction.id
    ) {
      return;
    }

    appliedFormatActionIdRef.current = pendingFormatAction.id;

    if (mode === "edit") {
      const result = visualEditorRef.current?.applyAction(pendingFormatAction.action);
      if (result) {
        pushToolbarHistory(openFile.content, result.content);
      }
      return;
    }

    const editor = editorScrollRef.current;
    const selectionStart = editor?.selectionStart ?? openFile.content.length;
    const selectionEnd = editor?.selectionEnd ?? selectionStart;
    const result = applyMarkdownAction(
      openFile.content,
      selectionStart,
      selectionEnd,
      pendingFormatAction.action,
    );

    pushToolbarHistory(openFile.content, result.content);
    onContentChange(result.content);

    window.requestAnimationFrame(() => {
      const currentEditor = editorScrollRef.current;
      if (!currentEditor) {
        return;
      }

      currentEditor.focus();
      currentEditor.setSelectionRange(
        result.selection.start,
        result.selection.end,
      );
    });
  }, [mode, onContentChange, openFile, pendingFormatAction, pushToolbarHistory]);

  const previewContent = openFile ? (
    openFile.kind === "md" ? (
      <MarkdownPreview
        ref={setPreviewScrollRef}
        html={renderedMarkdown}
        onScroll={handlePreviewScroll}
        onLinkClick={onLinkClick}
      />
    ) : (
      <PlainTextPreview
        ref={setPreviewScrollRef}
        content={openFile.content}
        onScroll={handlePreviewScroll}
      />
    )
  ) : null;

  return (
    <main className="content" aria-label="Markdown preview">
      {error ? <Notice tone="error">{error}</Notice> : null}

      {openFile ? (
        <article className={`preview-pane mode-${mode}`}>
          {actionBar}
          {findBar}

          <div className="document-layout">
            {mode === "edit" && openFile.kind === "md" ? (
              <section
                className="document-panel rendered-panel visual-editor-panel"
                aria-label="Markdown editor"
              >
                <LexicalMarkdownEditor
                  ref={visualEditorRef}
                  content={openFile.content}
                  onChange={handleEditorContentChange}
                  onScroll={handlePreviewScroll}
                  rootRef={visualEditorRootRef}
                />
              </section>
            ) : null}

            {mode === "code" || (mode === "edit" && openFile.kind !== "md") ? (
              <section className="document-panel editor-panel" aria-label="Editor">
                <textarea
                  ref={editorScrollRef}
                  className="editor"
                  spellCheck={false}
                  value={openFile.content}
                  onScroll={handleEditorScroll}
                  onChange={(event) => handleEditorContentChange(event.target.value)}
                />
              </section>
            ) : null}

            {mode !== "edit" ? (
              <section className="document-panel rendered-panel" aria-label="Preview">
                {previewContent}
              </section>
            ) : null}
          </div>

          <div className="file-meta">
            <span>{openFile.kind === "md" ? "Markdown" : "Text"}</span>
            <span>{parentPath(openFile.path)}</span>
          </div>
        </article>
      ) : (
        <EmptyPreview />
      )}
    </main>
  );
}
