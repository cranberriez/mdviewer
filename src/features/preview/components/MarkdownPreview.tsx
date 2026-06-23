interface MarkdownPreviewProps {
  html: string;
}

export function MarkdownPreview({ html }: MarkdownPreviewProps) {
  return (
    <div className="preview-inner">
      <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
