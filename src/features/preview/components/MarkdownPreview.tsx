import { forwardRef, type UIEventHandler } from "react";

interface MarkdownPreviewProps {
  html: string;
  onScroll: UIEventHandler<HTMLDivElement>;
}

export const MarkdownPreview = forwardRef<HTMLDivElement, MarkdownPreviewProps>(
  function MarkdownPreview({ html, onScroll }, ref) {
  return (
    <div
      ref={ref}
      className="preview-inner"
      data-find-content="true"
      onScroll={onScroll}
    >
      <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
  },
);
