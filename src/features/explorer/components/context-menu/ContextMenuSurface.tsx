import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAnchoredPosition } from './useAnchoredPosition';
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
}

export function ContextMenuSurface<Action extends string>({
	x,
	y,
	entries,
	onSelect,
	onClose,
	keepOpenOn = [],
}: ContextMenuSurfaceProps<Action>) {
	const { menuRef, position, ready } = useAnchoredPosition<HTMLDivElement>(x, y, [entries]);
	useMenuDismiss(menuRef, onClose);

	return createPortal(
		<div
			ref={menuRef}
			className={`ctx-menu ${ready ? 'show' : ''}`}
			role="menu"
			style={{ left: position.x, top: position.y }}
		>
			{entries.map((entry, index) => {
				if (isSeparator(entry)) {
					// eslint-disable-next-line react/no-array-index-key
					return <div key={`sep-${index}`} className="ctx-sep" />;
				}

				const Icon = entry.checked !== undefined ? Check : entry.icon;
				return (
					<button
						key={`${entry.label}-${index}`}
						type="button"
						role={entry.checked !== undefined ? 'menuitemcheckbox' : 'menuitem'}
						aria-checked={entry.checked !== undefined ? entry.checked : undefined}
						className={`ctx-item ${entry.danger ? 'danger' : ''}`}
						disabled={entry.disabled}
						title={entry.title}
						onClick={() => {
							if (entry.disabled) {
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
						{entry.shortcut ? <span className="ci-key">{entry.shortcut}</span> : null}
					</button>
				);
			})}
		</div>,
		document.body
	);
}
