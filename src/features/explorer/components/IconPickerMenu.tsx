import { createPortal } from 'react-dom';
import {
	Archive,
	Beaker,
	BookOpen,
	Briefcase,
	Camera,
	Clock,
	Cloud,
	Code2,
	Cpu,
	Database,
	Download,
	FileText,
	Folder,
	Globe,
	GraduationCap,
	Heart,
	Home,
	Image,
	Layers,
	LayoutDashboard,
	Lightbulb,
	Music,
	Pencil,
	Settings,
	Star,
	Tag,
	Users,
	Video,
	Wallet,
	Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAnchoredPosition } from './context-menu/useAnchoredPosition';
import { useMenuDismiss } from './context-menu/useMenuDismiss';

export interface IconOption {
	name: string;
	icon: LucideIcon;
}

export const ICON_OPTIONS: IconOption[] = [
	{ name: 'Folder', icon: Folder },
	{ name: 'Home', icon: Home },
	{ name: 'BookOpen', icon: BookOpen },
	{ name: 'FileText', icon: FileText },
	{ name: 'Pencil', icon: Pencil },
	{ name: 'Code2', icon: Code2 },
	{ name: 'Archive', icon: Archive },
	{ name: 'Download', icon: Download },
	{ name: 'Image', icon: Image },
	{ name: 'Music', icon: Music },
	{ name: 'Video', icon: Video },
	{ name: 'Camera', icon: Camera },
	{ name: 'Briefcase', icon: Briefcase },
	{ name: 'Users', icon: Users },
	{ name: 'GraduationCap', icon: GraduationCap },
	{ name: 'Lightbulb', icon: Lightbulb },
	{ name: 'Star', icon: Star },
	{ name: 'Heart', icon: Heart },
	{ name: 'Tag', icon: Tag },
	{ name: 'Globe', icon: Globe },
	{ name: 'Cloud', icon: Cloud },
	{ name: 'Database', icon: Database },
	{ name: 'Cpu', icon: Cpu },
	{ name: 'Layers', icon: Layers },
	{ name: 'LayoutDashboard', icon: LayoutDashboard },
	{ name: 'Beaker', icon: Beaker },
	{ name: 'Wallet', icon: Wallet },
	{ name: 'Settings', icon: Settings },
	{ name: 'Wrench', icon: Wrench },
	{ name: 'Clock', icon: Clock },
];

export function getIconComponent(name: string): LucideIcon {
	return ICON_OPTIONS.find((opt) => opt.name === name)?.icon ?? Folder;
}

interface IconPickerMenuProps {
	x: number;
	y: number;
	currentIcon?: string;
	onSelect: (iconName: string) => void;
	onClose: () => void;
}

export function IconPickerMenu({ x, y, currentIcon, onSelect, onClose }: IconPickerMenuProps) {
	const { menuRef, position, ready } = useAnchoredPosition<HTMLDivElement>(x, y);
	useMenuDismiss(menuRef, onClose);

	return createPortal(
		<div
			ref={menuRef}
			className={`icon-picker-menu ${ready ? 'show' : ''}`}
			role="dialog"
			aria-label="Choose an icon"
			style={{ left: position.x, top: position.y }}
		>
			<div className="icon-picker-label">Choose an icon</div>
			<div className="icon-picker-grid">
				{ICON_OPTIONS.map(({ name, icon: IconComponent }) => (
					<button
						key={name}
						type="button"
						className={`icon-picker-btn ${currentIcon === name ? 'selected' : ''}`}
						title={name}
						aria-label={name}
						aria-pressed={currentIcon === name}
						onClick={() => {
							onSelect(name);
							onClose();
						}}
					>
						<IconComponent size={16} />
					</button>
				))}
			</div>
		</div>,
		document.body
	);
}
