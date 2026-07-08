import {
	Bold,
	Code,
	FileCode,
	Heading,
	Image,
	Italic,
	Link,
	List,
	ListChecks,
	ListOrdered,
	Quote,
	Strikethrough,
	Table,
	type LucideIcon,
} from 'lucide-react';
import type { MarkdownAction } from '../../preview/markdownActions';
import { IconActionButton } from './IconActionButton';

interface MarkdownFormatToolbarProps {
	onAction: (action: MarkdownAction) => void;
}

const groups: Array<
	Array<{
		action: MarkdownAction;
		Icon: LucideIcon;
		tooltip: string;
	}>
> = [
	[
		{ action: 'bold', Icon: Bold, tooltip: 'Bold' },
		{ action: 'italic', Icon: Italic, tooltip: 'Italic' },
		{ action: 'strike', Icon: Strikethrough, tooltip: 'Strikethrough' },
	],
	[
		{ action: 'heading', Icon: Heading, tooltip: 'Heading' },
		{ action: 'quote', Icon: Quote, tooltip: 'Quote' },
	],
	[
		{ action: 'bulletList', Icon: List, tooltip: 'Bullet list' },
		{ action: 'numberedList', Icon: ListOrdered, tooltip: 'Numbered list' },
		{ action: 'checkList', Icon: ListChecks, tooltip: 'Checklist' },
	],
	[
		{ action: 'link', Icon: Link, tooltip: 'Link' },
		{ action: 'image', Icon: Image, tooltip: 'Image' },
	],
	[
		{ action: 'inlineCode', Icon: Code, tooltip: 'Inline code' },
		{ action: 'codeBlock', Icon: FileCode, tooltip: 'Code block' },
		{ action: 'table', Icon: Table, tooltip: 'Table' },
	],
];

export function MarkdownFormatToolbar({ onAction }: MarkdownFormatToolbarProps) {
	return (
		<div className="format-bar" aria-label="Markdown formatting toolbar">
			{groups.map((group, groupIndex) => (
				<div className="format-bar-group" key={groupIndex}>
					{group.map((item) => (
						<IconActionButton
							className="format-button"
							key={item.action}
							tooltip={item.tooltip}
							onMouseDown={(event) => {
								event.preventDefault();
							}}
							onClick={() => onAction(item.action)}
						>
							<item.Icon size={15} />
						</IconActionButton>
					))}
				</div>
			))}
		</div>
	);
}
