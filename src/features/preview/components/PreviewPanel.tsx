import type { OpenFile } from "../../../shared/types/files";
import { parentPath } from "../../../shared/utils/path";
import { Notice } from "../../../shared/ui/components/Notice";
import { EmptyPreview } from "./EmptyPreview";
import { MarkdownPreview } from "./MarkdownPreview";
import { PlainTextPreview } from "./PlainTextPreview";

interface PreviewPanelProps {
  error: string | null;
  openFile: OpenFile | null;
  renderedMarkdown: string;
}

export function PreviewPanel({
  error,
  openFile,
  renderedMarkdown,
}: PreviewPanelProps) {
  return (
    <main className="content" aria-label="Markdown preview">
      {error ? <Notice tone="error">{error}</Notice> : null}

      {openFile ? (
        <article className="preview-pane">
          <div className="file-meta">
            <span>{openFile.kind === "md" ? "Markdown" : "Text"}</span>
            <span>{parentPath(openFile.path)}</span>
          </div>

          {openFile.kind === "md" ? (
            <MarkdownPreview html={renderedMarkdown} />
          ) : (
            <PlainTextPreview content={openFile.content} />
          )}
        </article>
      ) : (
        <EmptyPreview />
      )}
    </main>
  );
}
