import { Moon, Sun } from 'lucide-react';
import { useUiStore } from '../../app-shell/state/useUiStore';

export function SidebarFooter() {
	const theme = useUiStore((state) => state.theme);
	const setTheme = useUiStore((state) => state.setTheme);

	return (
		<div className="sidebar-footer">
			<button
				type="button"
				className="sidebar-footer-button"
				title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
				aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
				onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
			>
				{theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
			</button>
		</div>
	);
}
