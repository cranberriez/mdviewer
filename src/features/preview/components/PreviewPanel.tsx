import {
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
  type UIEvent,
} from "react";
import type { FileViewMode } from "../../file-actions/components/FileActionControls";
import type { OpenFile } from "../../../shared/types/files";
import { parentPath } from "../../../shared/utils/path";
import { Notice } from "../../../shared/ui/components/Notice";
import { EmptyPreview } from "./EmptyPreview";
import { MarkdownPreview } from "./MarkdownPreview";
import { PlainTextPreview } from "./PlainTextPreview";

interface PreviewPanelProps {
  actionBar: ReactNode;
  error: string | null;
  findBar: ReactNode;
  findTargetRef: RefObject<HTMLElement | null>;
  mode: FileViewMode;
  openFile: OpenFile | null;
  onContentChange: (content: string) => void;
  renderedMarkdown: string;
}

type ScrollPanel = "editor" | "preview";

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
  renderedMarkdown,
}: PreviewPanelProps) {
  const editorScrollRef = useRef<HTMLTextAreaElement | null>(null);
  const previewScrollRef = useRef<HTMLElement | null>(null);
  const centerRatioRef = useRef(0);
  const ignoredScrollPanelRef = useRef<ScrollPanel | null>(null);
  const lastScrolledPanelRef = useRef<ScrollPanel>("preview");

  const setPreviewScrollRef = useCallback(
    (node: HTMLElement | null) => {
      previewScrollRef.current = node;
      findTargetRef.current = node;
    },
    [findTargetRef],
  );

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

  useEffect(() => {
    centerRatioRef.current = 0;
    ignoredScrollPanelRef.current = null;
    lastScrolledPanelRef.current = "preview";
  }, [openFile?.path]);

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
    if (!openFile || mode !== "edit") {
      return;
    }

    const target = lastScrolledPanelRef.current === "editor" ? "preview" : "editor";
    const frame = window.requestAnimationFrame(() => {
      applyCenterRatio(target, centerRatioRef.current);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [applyCenterRatio, mode, openFile?.content, openFile?.path, renderedMarkdown]);

  const previewContent = openFile ? (
    openFile.kind === "md" ? (
      <MarkdownPreview
        ref={setPreviewScrollRef}
        html={renderedMarkdown}
        onScroll={handlePreviewScroll}
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
            {mode === "edit" ? (
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

            <section className="document-panel rendered-panel" aria-label="Preview">
              {previewContent}
            </section>
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
