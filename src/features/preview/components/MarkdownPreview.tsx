import {
	forwardRef,
	useCallback,
	type ClipboardEvent,
	type MouseEvent,
	type UIEventHandler,
} from 'react';
import { rangeToMarkdown } from '../domToMarkdown';

interface MarkdownPreviewProps {
	html: string;
	onScroll: UIEventHandler<HTMLDivElement>;
	onLinkClick: (href: string) => void;
}

export const MarkdownPreview = forwardRef<HTMLDivElement, MarkdownPreviewProps>(
	function MarkdownPreview({ html, onScroll, onLinkClick }, ref) {
		// Copying from the read-only preview puts the Markdown *source* on the
		// clipboard (symbols preserved) instead of the rendered plain text. Fired by
		// Ctrl+C, right-click copy, and the Edit > Copy menu (which triggers a native
		// copy of the current selection).
		const handleCopy = useCallback((event: ClipboardEvent<HTMLDivElement>) => {
			const selection = window.getSelection();
			if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
				return;
			}

			const markdown = rangeToMarkdown(selection.getRangeAt(0));
			if (!markdown) {
				return;
			}

			event.preventDefault();
			event.clipboardData.setData('text/plain', markdown);
		}, []);

		const handleClick = useCallback(
			(event: MouseEvent<HTMLDivElement>) => {
				const anchor = (event.target as HTMLElement).closest('a');
				if (!anchor) {
					return;
				}

				// Prefer the raw attribute over the resolved `.href` so relative file
				// targets aren't rewritten into the app's own URL by the browser.
				const href = anchor.getAttribute('href');
				if (!href) {
					return;
				}

				// Never let the in-app webview navigate; routing is handled by App.
				event.preventDefault();
				onLinkClick(href);
			},
			[onLinkClick]
		);

		return (
			<div ref={ref} className="preview-scroll" data-find-content="true" onScroll={onScroll}>
				<div
					className="preview-inner md"
					onClick={handleClick}
					onCopy={handleCopy}
					dangerouslySetInnerHTML={{ __html: html }}
				/>
			</div>
		);
	}
);
