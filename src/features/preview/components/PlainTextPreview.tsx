import { forwardRef } from "react";

interface PlainTextPreviewProps {
  content: string;
}

export const PlainTextPreview = forwardRef<HTMLPreElement, PlainTextPreviewProps>(
  function PlainTextPreview({ content }, ref) {
    return (
      <pre ref={ref} className="plain" data-find-content="true">
        {content}
      </pre>
    );
  },
);
