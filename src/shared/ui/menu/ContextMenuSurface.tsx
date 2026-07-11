import { createPortal } from 'react-dom';
import { Check, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState, type RefObject } from 'react';
import { useAnchoredPosition, type AnchoredPositionOptions } from './useAnchoredPosition';
import { useMenuDismiss } from './useMenuDismiss';

export interface MenuItem<Action extends string> {
	id: Action;
	label: string;
	icon?: LucideIcon;
	shortcut?: string;
	danger?: boolean;
	disabled?: boolean;
	checked?: boolean;
	title?: string;
	submenu?: MenuEntry<Action>[];
}

export interface MenuSeparator {
	separator: true;
}

export type MenuEntry<Action extends string> = MenuItem<Action> | MenuSeparator;

export function isSeparator<Action extends string>(
	entry: MenuEntry<Action>
): entry is MenuSeparator {
	return 'separator' in entry;
}

interface ContextMenuSurfaceProps<Action extends string> {
	x: number;
	y: number;
	entries: MenuEntry<Action>[];
	onSelect: (action: Action) => void;
	onClose: () => void;
	keepOpenOn?: readonly Action[];
	className?: string;
	positionOptions?: AnchoredPositionOptions;
	dismiss?: boolean;
	dismissIgnoreRefs?: RefObject<Element | null>[];
	dismissIgnoreSelector?: string;
}

export function ContextMenuSurface<Action extends string>({
	x,
	y,
	entries,
	onSelect,
	onClose,
	keepOpenOn = [],
	className = '',
	positionOptions,
	dismiss = true,
	dismissIgnoreRefs,
	dismissIgnoreSelector,
}: ContextMenuSurfaceProps<Action>) {
	const [submenu, setSubmenu] = useState<{
		index: number;
		x: number;
		y: number;
		fallbackX: (width: number) => number;
		entries: MenuEntry<Action>[];
	} | null>(null);
	const { menuRef, position, ready } = useAnchoredPosition<HTMLDivElement>(
		x,
		y,
		[entries],
		positionOptions
	);
	const combinedIgnoreSelector = ['.ctx-submenu', dismissIgnoreSelector].filter(Boolean).join(', ');
	useMenuDismiss(menuRef, onClose, {
		enabled: dismiss,
		ignoreRefs: dismissIgnoreRefs,
		ignoreSelector: combinedIgnoreSelector,
	});

	function openSubmenu(entry: MenuItem<Action>, index: number, button: HTMLButtonElement) {
		if (!entry.submenu?.length || entry.disabled) {
			setSubmenu(null);
			return;
		}

		const rect = button.getBoundingClientRect();
		setSubmenu({
			index,
			x: rect.right + 4,
			y: rect.top,
			fallbackX: (width) => rect.left - width - 4,
			entries: entry.submenu,
		});
	}

	return createPortal(
		<div
			ref={menuRef}
			className={`${className ? `${className} ` : ''}ctx-menu ${ready ? 'show' : ''}`}
			role="menu"
			style={{ left: position.x, top: position.y }}
		>
			{entries.map((entry, index) => {
				if (isSeparator(entry)) {
					// eslint-disable-next-line react/no-array-index-key
					return (
						<div key={`sep-${index}`} className="ctx-sep" onMouseEnter={() => setSubmenu(null)} />
					);
				}

				const Icon = entry.checked !== undefined ? Check : entry.icon;
				const hasSubmenu = Boolean(entry.submenu?.length);
				return (
					<button
						key={`${entry.label}-${index}`}
						type="button"
						role={entry.checked !== undefined ? 'menuitemcheckbox' : 'menuitem'}
						aria-checked={entry.checked !== undefined ? entry.checked : undefined}
						aria-haspopup={hasSubmenu ? 'menu' : undefined}
						aria-expanded={hasSubmenu ? submenu?.index === index : undefined}
						className={`ctx-item ${entry.danger ? 'danger' : ''} ${submenu?.index === index ? 'submenu-open' : ''}`}
						disabled={entry.disabled}
						title={entry.title}
						onMouseEnter={(event) => openSubmenu(entry, index, event.currentTarget)}
						onFocus={(event) => openSubmenu(entry, index, event.currentTarget)}
						onClick={(event) => {
							if (entry.disabled) {
								return;
							}
							if (hasSubmenu) {
								openSubmenu(entry, index, event.currentTarget);
								return;
							}
							onSelect(entry.id);
							if (!keepOpenOn.includes(entry.id)) {
								onClose();
							}
						}}
					>
						<span className="ci-ico">
							{Icon && (entry.checked ?? true) ? <Icon size={15} /> : null}
						</span>
						<span className="ci-label">{entry.label}</span>
						{hasSubmenu ? (
							<span className="ci-key ctx-submenu-caret">
								<ChevronRight size={14} />
							</span>
						) : entry.shortcut ? (
							<span className="ci-key">{entry.shortcut}</span>
						) : null}
					</button>
				);
			})}
			{submenu ? (
				<ContextMenuSurface
					x={submenu.x}
					y={submenu.y}
					entries={submenu.entries}
					className={`${className} ctx-submenu`}
					positionOptions={{ fallbackX: submenu.fallbackX }}
					dismiss={false}
					onSelect={onSelect}
					onClose={onClose}
				/>
			) : null}
		</div>,
		document.body
	);
}
