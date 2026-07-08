import { FileText } from 'lucide-react';

export function EmptyPreview() {
	return (
		<div className="empty-state">
			<FileText size={30} />
			<h1>Select a markdown or text file</h1>
			<p>
				Browse a saved location on the left. Markdown files render in this panel; text files open in
				a plain monospaced view.
			</p>
		</div>
	);
}
