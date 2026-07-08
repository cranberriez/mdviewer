import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface MenuItem<Action extends string> {
	id: Action;
	label: string;
	icon?: LucideIcon;
	shortcut?: string;
	danger?: boolean;
	disabled?: boolean;
	checked?: boolean;
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
}

const VIEWPORT_PADDING = 8;

export function ContextMenuSurface<Action extends string>({
	x,
	y,
	entries,
	onSelect,
	onClose,
}: ContextMenuSurfaceProps<Action>) {
	const menuRef = useRef<HTMLDivElement | null>(null);
	const [position, setPosition] = useState({ x, y });
	const [ready, setReady] = useState(false);

	useLayoutEffect(() => {
		const menu = menuRef.current;
		if (!menu) {
			return;
		}

		const { offsetWidth: width, offsetHeight: height } = menu;
		let nextX = x;
		let nextY = y;

		if (nextX + width + VIEWPORT_PADDING > window.innerWidth) {
			nextX = Math.max(VIEWPORT_PADDING, window.innerWidth - width - VIEWPORT_PADDING);
		}
		if (nextY + height + VIEWPORT_PADDING > window.innerHeight) {
			nextY = Math.max(VIEWPORT_PADDING, window.innerHeight - height - VIEWPORT_PADDING);
		}

		setPosition({ x: nextX, y: nextY });
		setReady(true);
	}, [x, y, entries]);

	useEffect(() => {
		function handlePointerDown(event: MouseEvent) {
			if (!menuRef.current?.contains(event.target as Node)) {
				onClose();
			}
		}
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				onClose();
			}
		}

		window.addEventListener('mousedown', handlePointerDown);
		window.addEventListener('contextmenu', handlePointerDown);
		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('blur', onClose);
		window.addEventListener('resize', onClose);

		return () => {
			window.removeEventListener('mousedown', handlePointerDown);
			window.removeEventListener('contextmenu', handlePointerDown);
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('blur', onClose);
			window.removeEventListener('resize', onClose);
		};
	}, [onClose]);

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
						onClick={() => {
							if (entry.disabled) {
								return;
							}
							onSelect(entry.id);
							onClose();
						}}
					>
						<span className="ci-ico">{Icon && (entry.checked ?? true) ? <Icon size={15} /> : null}</span>
						<span className="ci-label">{entry.label}</span>
						{entry.shortcut ? <span className="ci-key">{entry.shortcut}</span> : null}
					</button>
				);
			})}
		</div>,
		document.body
	);
}
