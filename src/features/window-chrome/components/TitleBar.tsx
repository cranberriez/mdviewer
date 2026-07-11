import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ArrowLeft, ArrowRight, LayoutDashboard, Minus, Square, X } from 'lucide-react';
import { MenuBar, type MenuBarState } from './MenuBar';
import { PathBreadcrumb } from './PathBreadcrumb';

// Below this titlebar width the File/Edit/View row collapses to a single
// hamburger button so the breadcrumb and window controls keep their space.
const MENU_COLLAPSE_WIDTH = 620;

interface TitleBarProps {
	fileActionsSlot?: ReactNode;
	menuState: MenuBarState;
	currentPath?: string;
	currentPathKind?: 'file' | 'folder';
	rootName?: string;
	scopeNames?: string[];
	title: string;
	onMenuAction: (id: string) => void;
	canGoBack: boolean;
	canGoForward: boolean;
	navigationMode?: 'workspace' | 'home' | 'hidden';
	onGoBack: () => void;
	onGoForward: () => void;
	onGoHome: () => void;
	onNavigatePath: (path: string) => Promise<void>;
}

export function TitleBar({
	fileActionsSlot,
	menuState,
	currentPath,
	currentPathKind = 'folder',
	rootName,
	scopeNames = [],
	title,
	onMenuAction,
	canGoBack,
	canGoForward,
	navigationMode = 'workspace',
	onGoBack,
	onGoForward,
	onGoHome,
	onNavigatePath,
}: TitleBarProps) {
	const [isMaximized, setIsMaximized] = useState(false);
	const headerRef = useRef<HTMLElement | null>(null);
	const [menuCompact, setMenuCompact] = useState(false);

	// Collapse the menu to a hamburger when the titlebar gets narrow.
	useLayoutEffect(() => {
		const header = headerRef.current;
		if (!header || typeof ResizeObserver === 'undefined') {
			return;
		}
		const observer = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width ?? header.clientWidth;
			setMenuCompact(width < MENU_COLLAPSE_WIDTH);
		});
		observer.observe(header);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		const appWindow = getCurrentWindow();
		let cancelled = false;
		let unlistenResize: (() => void) | undefined;

		async function setup() {
			try {
				const maximized = await appWindow.isMaximized();
				if (!cancelled) setIsMaximized(maximized);

				const unlisten = await appWindow.onResized(async () => {
					const v = await appWindow.isMaximized();
					if (!cancelled) setIsMaximized(v);
				});

				if (cancelled) {
					unlisten();
				} else {
					unlistenResize = unlisten;
				}
			} catch {
				// Best effort — window APIs may not be available outside Tauri.
			}
		}

		void setup();

		return () => {
			cancelled = true;
			unlistenResize?.();
		};
	}, []);

	return (
		<header className="titlebar" data-tauri-drag-region ref={headerRef}>
			{navigationMode === 'workspace' ? (
				<button
					type="button"
					className="titlebar-button titlebar-home"
					aria-label="Open dashboard"
					title="Open dashboard"
					onClick={onGoHome}
				>
					<LayoutDashboard size={15} />
				</button>
			) : null}

			{navigationMode !== 'hidden' ? (
				<div className="titlebar-navigation" aria-label="Navigation">
					<button
						type="button"
						className="titlebar-button"
						aria-label="Go back"
						title="Go back (Alt+Left, Mouse 4)"
						disabled={!canGoBack}
						onClick={onGoBack}
					>
						<ArrowLeft size={15} />
					</button>
					{navigationMode === 'workspace' ? (
						<button
							type="button"
							className="titlebar-button"
							aria-label="Go forward"
							title="Go forward (Alt+Right, Mouse 5)"
							disabled={!canGoForward}
							onClick={onGoForward}
						>
							<ArrowRight size={15} />
						</button>
					) : null}
				</div>
			) : null}

			<MenuBar state={menuState} compact={menuCompact} onAction={onMenuAction} />

			{navigationMode !== 'workspace' ? (
				<div className="titlebar-crumb" data-tauri-drag-region>
					<span data-tauri-drag-region>{title}</span>
				</div>
			) : (
				<PathBreadcrumb
					currentPath={currentPath}
					currentPathKind={currentPathKind}
					rootName={rootName}
					scopeNames={scopeNames}
					title={title}
					onNavigate={onNavigatePath}
				/>
			)}

			<div className="titlebar-drag-space" data-tauri-drag-region />

			{fileActionsSlot ? <div className="titlebar-actions">{fileActionsSlot}</div> : null}

			<div className="window-controls">
				<button
					type="button"
					className="window-button"
					aria-label="Minimize"
					title="Minimize"
					onClick={() => void getCurrentWindow().minimize()}
				>
					<Minus size={14} />
				</button>
				<button
					type="button"
					className="window-button"
					aria-label={isMaximized ? 'Restore' : 'Maximize'}
					title={isMaximized ? 'Restore' : 'Maximize'}
					onClick={() => void getCurrentWindow().toggleMaximize()}
				>
					{isMaximized ? (
						/* Restore icon: two overlapping squares */
						<svg
							width="13"
							height="13"
							viewBox="0 0 13 13"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.25"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<rect x="3" y="1" width="9" height="9" rx="1" />
							<path d="M1 4v7a1 1 0 001 1h7" />
						</svg>
					) : (
						<Square size={12} />
					)}
				</button>
				<button
					type="button"
					className="window-button close"
					aria-label="Close"
					title="Close"
					onClick={() => void getCurrentWindow().close()}
				>
					<X size={14} />
				</button>
			</div>
		</header>
	);
}
