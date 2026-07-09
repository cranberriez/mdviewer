import {
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type MouseEvent as ReactMouseEvent,
	type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import {
	ChevronRight,
	Clock3,
	Clipboard,
	ClipboardPaste,
	Code2,
	Copy,
	CornerUpLeft,
	Eye,
	FilePlus,
	FolderOpen,
	FolderPlus,
	List,
	Menu as MenuIcon,
	Moon,
	Pencil,
	Redo2,
	RefreshCw,
	Replace,
	Save,
	Scissors,
	Search,
	Settings,
	Sun,
	Undo2,
} from 'lucide-react';
import { ContextMenuSurface, type MenuEntry } from '../../../shared/ui/menu/ContextMenuSurface';
import { useAnchoredPosition } from '../../../shared/ui/menu/useAnchoredPosition';
import { useMenuDismiss } from '../../../shared/ui/menu/useMenuDismiss';
import type { RecentItem } from '../../../shared/state/persistence';

type MenuBarAction = string;

export interface TopMenuDef {
	id: string;
	label: string;
	entries: MenuEntry<MenuBarAction>[];
}

// State surfaced from the app so menus can reflect/disable items contextually
// (e.g. Save only makes sense with a file open and unsaved changes).
export interface MenuBarState {
	hasOpenFile: boolean;
	dirty: boolean;
	isMarkdown: boolean;
	isEditing: boolean;
	/** Copy is available in every mode (incl. read-only preview) when a file is open. */
	canCopy: boolean;
	explorerHidden: boolean;
	outlinePanelVisible: boolean;
	barMerged: boolean;
	theme: 'dark' | 'light';
	mode: 'edit' | 'preview' | 'code';
	recentRoots: RecentItem[];
}

interface MenuBarProps {
	state: MenuBarState;
	/** Collapse the File/Edit/View row into a single hamburger button. */
	compact: boolean;
	onAction: (id: string) => void;
}

// Build the menu definitions from current app state. Items wired to real
// behavior are enabled; not-yet-built features (replace variants) are disabled.
function buildMenus(state: MenuBarState): TopMenuDef[] {
	const editingText = state.hasOpenFile && state.isEditing;

	return [
		{
			id: 'file',
			label: 'File',
			entries: [
				{ id: 'new-file', label: 'New File…', icon: FilePlus, shortcut: 'Ctrl+N' },
				{ id: 'new-folder', label: 'New Folder…', icon: FolderPlus },
				{ separator: true },
				{ id: 'open-folder', label: 'Open Folder…', icon: FolderOpen, shortcut: 'Ctrl+K Ctrl+O' },
				...(state.recentRoots.length > 0
					? state.recentRoots.map((item, index) => ({
							id: `open-recent-${index}`,
							label: `Open Recent: ${item.name}`,
							icon: Clock3,
							title: item.path,
						}))
					: [
							{
								id: 'open-recent-empty',
								label: 'Open Recent',
								icon: Clock3,
								disabled: true,
							},
						]),
				{ separator: true },
				{
					id: 'save',
					label: 'Save',
					icon: Save,
					shortcut: 'Ctrl+S',
					disabled: !state.hasOpenFile || !state.dirty,
				},
				{ separator: true },
				{
					id: 'reveal',
					label: 'Reveal in File Explorer',
					icon: CornerUpLeft,
					shortcut: 'Shift+Alt+R',
					disabled: !state.hasOpenFile,
				},
				{
					id: 'preferences',
					label: 'Preferences',
					icon: Settings,
				},
			],
		},
		{
			id: 'edit',
			label: 'Edit',
			entries: [
				{ id: 'undo', label: 'Undo', icon: Undo2, shortcut: 'Ctrl+Z', disabled: !editingText },
				{ id: 'redo', label: 'Redo', icon: Redo2, shortcut: 'Ctrl+Y', disabled: !editingText },
				{ separator: true },
				{ id: 'cut', label: 'Cut', icon: Scissors, shortcut: 'Ctrl+X', disabled: !editingText },
				// Copy works in every mode, including read-only preview (copies the
				// current selection, as Markdown source when copying from the preview).
				{ id: 'copy', label: 'Copy', icon: Copy, shortcut: 'Ctrl+C', disabled: !state.canCopy },
				{
					id: 'paste',
					label: 'Paste',
					icon: ClipboardPaste,
					shortcut: 'Ctrl+V',
					disabled: !editingText,
				},
				{ separator: true },
				{
					id: 'find',
					label: 'Find',
					icon: Search,
					shortcut: 'Ctrl+F',
					disabled: !state.hasOpenFile,
				},
				{
					id: 'replace',
					label: 'Find & Replace',
					icon: Replace,
					shortcut: 'Ctrl+H',
					disabled: true,
				},
				{ separator: true },
				{ id: 'find-in-files', label: 'Find in Files', icon: Search, shortcut: 'Ctrl+Shift+F' },
				{
					id: 'replace-in-files',
					label: 'Replace in Files',
					icon: Clipboard,
					shortcut: 'Ctrl+Shift+H',
					disabled: true,
				},
			],
		},
		{
			id: 'view',
			label: 'View',
			entries: [
				{
					id: 'toggle-explorer',
					label: state.explorerHidden ? 'Show Explorer' : 'Hide Explorer',
					icon: Search,
					shortcut: 'Ctrl+B',
				},
				{
					id: 'toggle-outline-panel',
					label: state.outlinePanelVisible ? 'Hide Outline Panel' : 'Show Outline Panel',
					icon: List,
				},
				{ separator: true },
				{
					id: 'mode-preview',
					label: state.mode === 'preview' ? '✓ Preview' : 'Preview',
					icon: Eye,
					disabled: !state.hasOpenFile,
				},
				{
					id: 'mode-edit',
					label: state.mode === 'edit' ? '✓ Edit' : 'Edit',
					icon: Pencil,
					disabled: !state.hasOpenFile,
				},
				{
					id: 'mode-code',
					label: state.mode === 'code' ? '✓ Code' : 'Code',
					icon: Code2,
					disabled: !state.hasOpenFile,
				},
				{ separator: true },
				{
					id: 'toggle-bar',
					label: state.barMerged ? 'Move Action Bar Down' : 'Move Action Bar to Top',
					icon: RefreshCw,
					disabled: !state.hasOpenFile,
				},
				{ separator: true },
				{
					id: 'toggle-theme',
					label: state.theme === 'dark' ? 'Light Theme' : 'Dark Theme',
					icon: state.theme === 'dark' ? Sun : Moon,
				},
			],
		},
	];
}

// A flat dropdown panel anchored to a rect (the menu button). Used for the
// full-width File/Edit/View menus.
function DropdownPanel({
	menu,
	anchor,
	ignoreRefs,
	onAction,
	onClose,
}: {
	menu: TopMenuDef;
	anchor: DOMRect;
	ignoreRefs: RefObject<Element | null>[];
	onAction: (id: string) => void;
	onClose: () => void;
}) {
	return (
		<ContextMenuSurface
			x={anchor.left}
			y={anchor.bottom + 4}
			entries={menu.entries}
			className="menu-dropdown"
			positionOptions={{ fallbackY: (height) => anchor.top - height - 4 }}
			dismissIgnoreRefs={ignoreRefs}
			onSelect={onAction}
			onClose={onClose}
		/>
	);
}

// The compact hamburger menu: a vertical list of the top menus; hovering or
// focusing a row opens that menu's items in a submenu to the right.
function CompactMenu({
	menus,
	anchor,
	ignoreRefs,
	onAction,
	onClose,
}: {
	menus: TopMenuDef[];
	anchor: DOMRect;
	ignoreRefs: RefObject<Element | null>[];
	onAction: (id: string) => void;
	onClose: () => void;
}) {
	const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});
	const [activeId, setActiveId] = useState<string>(menus[0]?.id ?? '');
	const [subPos, setSubPos] = useState<{ x: number; y: number } | null>(null);
	const {
		menuRef: rootRef,
		position,
		ready,
	} = useAnchoredPosition<HTMLDivElement>(anchor.left, anchor.bottom + 4, [anchor], {
		fallbackY: (height) => anchor.top - height - 4,
	});
	useMenuDismiss(rootRef, onClose, {
		ignoreRefs,
		ignoreSelector: '.menu-dropdown',
	});

	// Position the submenu beside the active row.
	useLayoutEffect(() => {
		const row = rowRefs.current[activeId];
		const root = rootRef.current;
		if (!row || !root) {
			return;
		}
		const rootRect = root.getBoundingClientRect();
		const rowRect = row.getBoundingClientRect();
		setSubPos({ x: rootRect.right + 4, y: rowRect.top });
	}, [activeId, position, rootRef]);

	const activeMenu = menus.find((m) => m.id === activeId) ?? menus[0];

	return createPortal(
		<>
			<div
				ref={rootRef}
				className={`menu-dropdown menu-compact-root ctx-menu ${ready ? 'show' : ''}`}
				role="menu"
				style={{ left: position.x, top: position.y }}
			>
				{menus.map((menu) => (
					<button
						key={menu.id}
						type="button"
						role="menuitem"
						ref={(node) => {
							rowRefs.current[menu.id] = node;
						}}
						className={`ctx-item menu-compact-row ${menu.id === activeId ? 'active' : ''}`}
						onMouseEnter={() => setActiveId(menu.id)}
						onFocus={() => setActiveId(menu.id)}
						onClick={() => setActiveId(menu.id)}
					>
						<span className="ci-label">{menu.label}</span>
						<span className="ci-key menu-compact-caret">
							<ChevronRight size={14} />
						</span>
					</button>
				))}
			</div>

			{activeMenu && subPos ? (
				<ContextMenuSurface
					x={subPos.x}
					y={subPos.y}
					entries={activeMenu.entries}
					className="menu-dropdown menu-compact-sub"
					dismiss={false}
					onSelect={onAction}
					onClose={onClose}
				/>
			) : null}
		</>,
		document.body
	);
}

export function MenuBar({ state, compact, onAction }: MenuBarProps) {
	const menus = buildMenus(state);
	// `openId` is the id of the currently open top menu, or "__compact__" for the
	// hamburger panel, or null when nothing is open.
	const [openId, setOpenId] = useState<string | null>(null);
	const [anchor, setAnchor] = useState<DOMRect | null>(null);
	const barRef = useRef<HTMLDivElement | null>(null);
	const dismissIgnoreRefs = useMemo<RefObject<Element | null>[]>(() => [barRef], []);
	const reactId = useId();

	const close = useCallback(() => {
		setOpenId(null);
		setAnchor(null);
	}, []);

	// When the bar collapses/expands, any open menu would be stale - close it.
	useEffect(() => {
		close();
	}, [compact, close]);

	function toggleMenu(id: string, event: ReactMouseEvent<HTMLButtonElement>) {
		if (openId === id) {
			close();
			return;
		}
		setAnchor(event.currentTarget.getBoundingClientRect());
		setOpenId(id);
	}

	// While a top menu is open, hovering a sibling button switches to it
	// (classic menu-bar behavior).
	function hoverMenu(id: string, event: ReactMouseEvent<HTMLButtonElement>) {
		if (openId && openId !== '__compact__' && openId !== id) {
			setAnchor(event.currentTarget.getBoundingClientRect());
			setOpenId(id);
		}
	}

	const handleAction = useCallback(
		(id: string) => {
			onAction(id);
		},
		[onAction]
	);

	if (compact) {
		return (
			<div className="menubar menubar-compact" ref={barRef}>
				<button
					type="button"
					className={`titlebar-button menubar-hamburger ${openId === '__compact__' ? 'bright' : ''}`}
					aria-label="Menu"
					aria-haspopup="menu"
					aria-expanded={openId === '__compact__'}
					title="Menu"
					onClick={(event) => {
						if (openId === '__compact__') {
							close();
						} else {
							setAnchor(event.currentTarget.getBoundingClientRect());
							setOpenId('__compact__');
						}
					}}
				>
					<MenuIcon size={16} />
				</button>
				{openId === '__compact__' && anchor ? (
					<CompactMenu
						menus={menus}
						anchor={anchor}
						ignoreRefs={dismissIgnoreRefs}
						onAction={handleAction}
						onClose={close}
					/>
				) : null}
			</div>
		);
	}

	const activeMenu = menus.find((m) => m.id === openId) ?? null;

	return (
		<div className="menubar" ref={barRef} role="menubar" aria-label="Application menu">
			{menus.map((menu) => (
				<button
					key={`${reactId}-${menu.id}`}
					type="button"
					role="menuitem"
					aria-haspopup="menu"
					aria-expanded={openId === menu.id}
					className={`menubar-button ${openId === menu.id ? 'open' : ''}`}
					onClick={(event) => toggleMenu(menu.id, event)}
					onMouseEnter={(event) => hoverMenu(menu.id, event)}
				>
					{menu.label}
				</button>
			))}
			{activeMenu && anchor ? (
				<DropdownPanel
					menu={activeMenu}
					anchor={anchor}
					ignoreRefs={dismissIgnoreRefs}
					onAction={handleAction}
					onClose={close}
				/>
			) : null}
		</div>
	);
}
