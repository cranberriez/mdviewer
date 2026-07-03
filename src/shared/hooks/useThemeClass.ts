import { useEffect } from 'react';
import type { AppTheme } from '../state/persistence';

export function useThemeClass(theme: AppTheme) {
	useEffect(() => {
		document.body.classList.toggle('theme-light', theme === 'light');

		return () => {
			document.body.classList.remove('theme-light');
		};
	}, [theme]);
}
