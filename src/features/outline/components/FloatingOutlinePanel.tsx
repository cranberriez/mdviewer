import { OutlineView } from './OutlineView';

interface FloatingOutlinePanelProps {
	/** Rendered markdown HTML for the open file, or null for non-markdown / none. */
	renderedHtml: string | null;
	hasOpenFile: boolean;
	onSelectHeading: (id: string) => void;
}

/**
 * The outline rendered as a plain, chrome-less list floating in the content
 * area's left gutter — no background, border, header, or close button. Shares
 * the exact same `OutlineView` body as the sidebar tab. Visibility is toggled
 * from View ▸ Show Outline Panel.
 */
export function FloatingOutlinePanel({
	renderedHtml,
	hasOpenFile,
	onSelectHeading,
}: FloatingOutlinePanelProps) {
	return (
		<div className="outline-float">
			<OutlineView
				renderedHtml={renderedHtml}
				hasOpenFile={hasOpenFile}
				onSelect={onSelectHeading}
			/>
		</div>
	);
}
