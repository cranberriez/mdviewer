import { forwardRef, useCallback, type MouseEvent, type UIEventHandler } from "react";

interface MarkdownPreviewProps {
  html: string;
  onScroll: UIEventHandler<HTMLDivElement>;
  onLinkClick: (href: string) => void;
}

export const MarkdownPreview = forwardRef<HTMLDivElement, MarkdownPreviewProps>(
  function MarkdownPreview({ html, onScroll, onLinkClick }, ref) {
    const handleClick = useCallback(
      (event: MouseEvent<HTMLDivElement>) => {
        const anchor = (event.target as HTMLElement).closest("a");
        if (!anchor) {
          return;
        }

        // Prefer the raw attribute over the resolved `.href` so relative file
        // targets aren't rewritten into the app's own URL by the browser.
        const href = anchor.getAttribute("href");
        if (!href) {
          return;
        }

        // Never let the in-app webview navigate; routing is handled by App.
        event.preventDefault();
        onLinkClick(href);
      },
      [onLinkClick],
    );

    return (
      <div
        ref={ref}
        className="preview-inner"
        data-find-content="true"
        onScroll={onScroll}
      >
        <div
          className="md"
          onClick={handleClick}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    );
  },
);
