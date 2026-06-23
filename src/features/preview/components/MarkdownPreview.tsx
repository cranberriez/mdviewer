import { forwardRef } from "react";

interface MarkdownPreviewProps {
  html: string;
}

export const MarkdownPreview = forwardRef<HTMLDivElement, MarkdownPreviewProps>(
  function MarkdownPreview({ html }, ref) {
  return (
    <div ref={ref} className="preview-inner" data-find-content="true">
      <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
  },
);
