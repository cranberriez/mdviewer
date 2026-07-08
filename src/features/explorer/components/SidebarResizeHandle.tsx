import type { PointerEventHandler } from 'react';

interface SidebarResizeHandleProps {
	onPointerDown: PointerEventHandler<HTMLDivElement>;
}

export function SidebarResizeHandle({ onPointerDown }: SidebarResizeHandleProps) {
	return (
		<div
			className="sidebar-resizer"
			role="separator"
			aria-label="Resize file explorer"
			aria-orientation="vertical"
			onPointerDown={onPointerDown}
		/>
	);
}
