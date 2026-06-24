import { useMemo } from 'react';
import { extractOutline, withRelativeDepth } from '../outline';

interface OutlineViewProps {
	/**
	 * Rendered markdown HTML for the open file, or null when no markdown file is
	 * open. Headings (and their slug ids) are read from this so they always match
	 * the ids in the preview DOM.
	 */
	renderedHtml: string | null;
	/** Whether a file is currently open at all (drives the empty-state copy). */
	hasOpenFile: boolean;
	/** Currently highlighted heading id, if any. */
	activeId?: string | null;
	/** Click a heading: the consumer scrolls the preview to this slug id. */
	onSelect: (id: string) => void;
}

/**
 * Standalone, location-agnostic outline / table-of-contents. Renders a tree of
 * the open document's headings as buttons that, when clicked, ask the host to
 * scroll the preview to that heading. Deliberately self-contained so it can be
 * mounted in the sidebar (as a Sources tab) or in the floating left panel.
 */
export function OutlineView({ renderedHtml, hasOpenFile, activeId, onSelect }: OutlineViewProps) {
	const headings = useMemo(
		() => withRelativeDepth(extractOutline(renderedHtml ?? '')),
		[renderedHtml]
	);

	if (headings.length === 0) {
		const message = !hasOpenFile
			? 'Open a markdown file to see its outline.'
			: renderedHtml === null
				? 'Outlines are only available for markdown files.'
				: 'No headings in this document.';
		return (
			<div className="outline-empty">
				<p>{message}</p>
			</div>
		);
	}

	return (
		<nav className="outline-list" aria-label="Document outline">
			{headings.map((heading, index) => (
				<button
					// Ids are unique within a document (the slugger suffixes duplicates),
					// but fall back to the index to stay safe if that ever changes.
					key={`${heading.id}-${index}`}
					type="button"
					className={`outline-row ${activeId === heading.id ? 'active' : ''}`}
					style={{ paddingLeft: 10 + heading.depth * 14 }}
					data-level={heading.level}
					title={heading.text}
					onClick={() => onSelect(heading.id)}
				>
					<span className="outline-name">{heading.text}</span>
				</button>
			))}
		</nav>
	);
}
