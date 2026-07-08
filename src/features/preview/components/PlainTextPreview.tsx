import { forwardRef, type UIEventHandler } from 'react';

interface PlainTextPreviewProps {
	content: string;
	onScroll: UIEventHandler<HTMLDivElement>;
}

export const PlainTextPreview = forwardRef<HTMLDivElement, PlainTextPreviewProps>(
	function PlainTextPreview({ content, onScroll }, ref) {
		return (
			<div ref={ref} className="plain-scroll" data-find-content="true" onScroll={onScroll}>
				<pre className="plain">{content}</pre>
			</div>
		);
	}
);
