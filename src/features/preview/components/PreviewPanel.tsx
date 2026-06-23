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
  return (
    <main className="content" aria-label="Markdown preview">
      {error ? <Notice tone="error">{error}</Notice> : null}

      {openFile ? (
        <article className="preview-pane">
          {actionBar}
          {findBar}

          <div className="file-meta">
            <span>{openFile.kind === "md" ? "Markdown" : "Text"}</span>
            <span>{parentPath(openFile.path)}</span>
          </div>

          {mode === "edit" ? (
            <textarea
              className="min-h-0 flex-1 resize-none border-0 bg-transparent px-6 pb-6 pt-1 font-mono text-[13px] leading-[1.7] text-text-primary outline-none placeholder:text-text-muted"
              spellCheck={false}
              value={openFile.content}
              onChange={(event) => onContentChange(event.target.value)}
            />
          ) : openFile.kind === "md" ? (
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
          )}
        </article>
      ) : (
        <EmptyPreview />
      )}
    </main>
  );
}
