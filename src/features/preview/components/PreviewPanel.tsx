import type { ReactNode, RefObject } from "react";
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
  const previewContent = openFile ? (
    openFile.kind === "md" ? (
      <MarkdownPreview
        ref={(node) => {
          findTargetRef.current = node;
        }}
        html={renderedMarkdown}
      />
    ) : (
      <PlainTextPreview
        ref={(node) => {
          findTargetRef.current = node;
        }}
        content={openFile.content}
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

          <div className="file-meta">
            <span>{openFile.kind === "md" ? "Markdown" : "Text"}</span>
            <span>{parentPath(openFile.path)}</span>
          </div>

          <div className="document-layout">
            {mode === "edit" ? (
              <section className="document-panel editor-panel" aria-label="Editor">
                <textarea
                  className="editor"
                  spellCheck={false}
                  value={openFile.content}
                  onChange={(event) => onContentChange(event.target.value)}
                />
              </section>
            ) : null}

            <section className="document-panel rendered-panel" aria-label="Preview">
              {previewContent}
            </section>
          </div>
        </article>
      ) : (
        <EmptyPreview />
      )}
    </main>
  );
}
