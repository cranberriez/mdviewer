import { forwardRef, type UIEventHandler } from "react";

interface PlainTextPreviewProps {
  content: string;
  onScroll: UIEventHandler<HTMLPreElement>;
}

export const PlainTextPreview = forwardRef<HTMLPreElement, PlainTextPreviewProps>(
  function PlainTextPreview({ content, onScroll }, ref) {
    return (
      <pre
        ref={ref}
        className="plain"
        data-find-content="true"
        onScroll={onScroll}
      >
        {content}
      </pre>
    );
  },
);
