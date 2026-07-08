import type { MouseEvent as ReactMouseEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { IconActionButton } from '../../file-actions/components/IconActionButton';

export interface SidebarHeaderActionConfig {
	id: string;
	icon: LucideIcon;
	tooltip: string;
	visible?: boolean;
	active?: boolean;
	disabled?: boolean;
	role?: 'tab';
	ariaSelected?: boolean;
	ariaPressed?: boolean;
	ariaHasPopup?: 'menu';
	className?: string;
	iconClassName?: string;
	onClick: (event: ReactMouseEvent) => void;
}

interface SidebarHeaderActionsProps {
	actions: SidebarHeaderActionConfig[];
	baseClassName: string;
	iconSize: number;
}

export function SidebarHeaderActions({
	actions,
	baseClassName,
	iconSize,
}: SidebarHeaderActionsProps) {
	return actions
		.filter((action) => action.visible ?? true)
		.map((action) => {
			const Icon = action.icon;
			return (
				<IconActionButton
					key={action.id}
					className={`${baseClassName} ${action.className ?? ''} ${action.active ? 'active' : ''}`}
					tooltip={action.tooltip}
					title={action.tooltip}
					active={action.active}
					disabled={action.disabled}
					role={action.role}
					aria-selected={action.ariaSelected}
					aria-pressed={action.ariaPressed}
					aria-haspopup={action.ariaHasPopup}
					onClick={(event) => action.onClick(event)}
				>
					<Icon className={action.iconClassName} size={iconSize} />
				</IconActionButton>
			);
		});
}
