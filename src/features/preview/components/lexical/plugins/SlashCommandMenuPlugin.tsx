/**
 * Slash command menu. Type `/` at an empty/typing position to insert blocks:
 * headings, lists, checklist, quote, code, divider, table. Built on Lexical's
 * LexicalTypeaheadMenuPlugin. Lean custom UI/options (markdown-relevant only),
 * adapted from the playground's ComponentPickerPlugin.
 */
import { $createCodeNode } from '@lexical/code';
import {
	INSERT_CHECK_LIST_COMMAND,
	INSERT_ORDERED_LIST_COMMAND,
	INSERT_UNORDERED_LIST_COMMAND,
} from '@lexical/list';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $createHorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import {
	LexicalTypeaheadMenuPlugin,
	MenuOption,
	useBasicTypeaheadTriggerMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { INSERT_TABLE_COMMAND } from '@lexical/table';
import {
	$createParagraphNode,
	$getSelection,
	$insertNodes,
	$isRangeSelection,
	type ElementNode,
	type LexicalEditor,
	type TextNode,
} from 'lexical';
// NOTE: this project's lucide-react@1.21.0 is a fork build whose icon set we
// can't introspect from the sandbox. To stay safe we use ONLY icons already
// imported and rendered by the existing MarkdownFormatToolbar
// (Heading, List, ListOrdered, ListChecks, Quote, Code, FileCode, Table).
import {
	Code,
	FileCode,
	Heading,
	List,
	ListChecks,
	ListOrdered,
	Quote,
	Table,
	type LucideIcon,
} from 'lucide-react';
import { useCallback, useMemo, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';

class SlashOption extends MenuOption {
	title: string;
	Icon: LucideIcon;
	keywords: Array<string>;
	onSelect: () => void;

	constructor(
		title: string,
		options: { Icon: LucideIcon; keywords?: Array<string>; onSelect: () => void }
	) {
		super(title);
		this.title = title;
		this.Icon = options.Icon;
		this.keywords = options.keywords ?? [];
		this.onSelect = options.onSelect.bind(this);
	}
}

function $setBlock(create: () => ElementNode) {
	const selection = $getSelection();
	if ($isRangeSelection(selection)) {
		$setBlocksType(selection, create);
	}
}

function getOptions(editor: LexicalEditor): SlashOption[] {
	return [
		new SlashOption('Paragraph', {
			Icon: Quote,
			keywords: ['paragraph', 'text', 'normal', 'p'],
			onSelect: () => editor.update(() => $setBlock(() => $createParagraphNode())),
		}),
		new SlashOption('Heading 1', {
			Icon: Heading,
			keywords: ['heading', 'h1', 'title'],
			onSelect: () => editor.update(() => $setBlock(() => $createHeadingNode('h1'))),
		}),
		new SlashOption('Heading 2', {
			Icon: Heading,
			keywords: ['heading', 'h2', 'subtitle'],
			onSelect: () => editor.update(() => $setBlock(() => $createHeadingNode('h2'))),
		}),
		new SlashOption('Heading 3', {
			Icon: Heading,
			keywords: ['heading', 'h3'],
			onSelect: () => editor.update(() => $setBlock(() => $createHeadingNode('h3'))),
		}),
		new SlashOption('Bulleted list', {
			Icon: List,
			keywords: ['unordered', 'bullet', 'ul', 'list'],
			onSelect: () => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined),
		}),
		new SlashOption('Numbered list', {
			Icon: ListOrdered,
			keywords: ['ordered', 'number', 'ol', 'list'],
			onSelect: () => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined),
		}),
		new SlashOption('Check list', {
			Icon: ListChecks,
			keywords: ['todo', 'task', 'checkbox', 'check'],
			onSelect: () => editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined),
		}),
		new SlashOption('Quote', {
			Icon: Quote,
			keywords: ['blockquote', 'quote'],
			onSelect: () => editor.update(() => $setBlock(() => $createQuoteNode())),
		}),
		new SlashOption('Code block', {
			Icon: FileCode,
			keywords: ['code', 'snippet', 'fence'],
			onSelect: () => editor.update(() => $setBlock(() => $createCodeNode())),
		}),
		new SlashOption('Divider', {
			Icon: Code,
			keywords: ['horizontal rule', 'hr', 'divider', 'line'],
			onSelect: () => editor.update(() => $insertNodes([$createHorizontalRuleNode()])),
		}),
		new SlashOption('Table', {
			Icon: Table,
			keywords: ['table', 'grid', 'rows', 'columns'],
			onSelect: () =>
				editor.dispatchCommand(INSERT_TABLE_COMMAND, {
					columns: '2',
					rows: '2',
					includeHeaders: true,
				}),
		}),
	];
}

export default function SlashCommandMenuPlugin(): JSX.Element {
	const [editor] = useLexicalComposerContext();
	const [queryString, setQueryString] = useState<string | null>(null);

	const checkForTriggerMatch = useBasicTypeaheadTriggerMatch('/', {
		minLength: 0,
	});

	const options = useMemo(() => {
		const base = getOptions(editor);
		if (!queryString) {
			return base;
		}
		const regex = new RegExp(queryString, 'i');
		return base.filter(
			(option) => regex.test(option.title) || option.keywords.some((keyword) => regex.test(keyword))
		);
	}, [editor, queryString]);

	const onSelectOption = useCallback(
		(selectedOption: SlashOption, nodeToRemove: TextNode | null, closeMenu: () => void) => {
			editor.update(() => {
				nodeToRemove?.remove();
				selectedOption.onSelect();
				closeMenu();
			});
		},
		[editor]
	);

	return (
		<LexicalTypeaheadMenuPlugin<SlashOption>
			onQueryChange={setQueryString}
			onSelectOption={onSelectOption}
			triggerFn={checkForTriggerMatch}
			options={options}
			menuRenderFn={(
				anchorElementRef,
				{ selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }
			) =>
				anchorElementRef.current && options.length
					? createPortal(
							<div className="lexical-slash-menu">
								<ul>
									{options.map((option, index) => (
										<li
											key={option.key}
											role="option"
											aria-selected={selectedIndex === index}
											ref={option.setRefElement}
											className={`lexical-slash-item${selectedIndex === index ? ' selected' : ''}`}
											onMouseEnter={() => setHighlightedIndex(index)}
											onMouseDown={(event) => event.preventDefault()}
											onClick={() => selectOptionAndCleanUp(option)}
										>
											<option.Icon size={15} />
											<span>{option.title}</span>
										</li>
									))}
								</ul>
							</div>,
							anchorElementRef.current
						)
					: null
			}
		/>
	);
}
