import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import {
	defaultLocations,
	deletePath,
	pickFolder,
	readFolder,
	revealInExplorer,
} from './features/files/api/filesApi';
import type { SidebarMode } from './features/explorer/components/Sidebar';
import type {
	ContextMenuAction,
	ContextMenuTarget,
	ContextMenuVariant,
} from './features/explorer/components/ContextMenu';
import type { ExplorerHeaderMenuAction } from './features/explorer/components/context-menu/ExplorerHeaderContextMenu';
import type { SourcesHeaderMenuAction } from './features/explorer/components/context-menu/SourcesHeaderContextMenu';
import type { SavedMenuAction } from './features/explorer/components/SavedContextMenu';
import {
	DEFAULT_SIDEBAR_WIDTH,
	useSidebarResize,
} from './features/explorer/hooks/useSidebarResize';
import type { FileViewMode } from './features/file-actions/components/FileActionControls';
import { useAppFileActionSlots } from './features/file-actions/components/AppFileActionSlots';
import { useFindInPreview } from './features/file-actions/hooks/useFindInPreview';
import type { MarkdownAction } from './features/preview/markdownActions';
import { usePreviewNavigation } from './features/preview/hooks/usePreviewNavigation';
import {
	useOpenFileController,
	type UnsavedFileDrafts,
} from './features/files/hooks/useOpenFileController';
import { useAppDragDropController } from './features/dnd/useAppDragDropController';
import { DragLayer } from './features/dnd/DragLayer';
import { TreeDropBadge } from './features/dnd/TreeDropBadge';
import type { Entry } from './shared/types/files';
import {
	comparablePath,
	fileKindFromPath,
	fileName,
	parentName,
	parentPath,
	relativePath,
} from './shared/utils/path';
import {
	loadAppConfiguration,
	loadAppSession,
	recentItemKind,
	saveAppConfiguration,
	saveAppSession,
	DEFAULT_EXPLORER_HEADER_ACTIONS_VISIBLE,
	DEFAULT_SOURCES_HEADER_ACTIONS_VISIBLE,
	type AppConfigurationState,
	type AppTheme,
	type ExplorerHeaderActionsVisibility,
	type RecentItem,
	type SourcesHeaderActionsVisibility,
	type StoredWindowFrame,
} from './shared/state/persistence';
import { useThemeClass } from './shared/hooks/useThemeClass';
import { useWindowFramePersistence } from './features/window-chrome/hooks/useWindowFramePersistence';
import { useCrossFileSearch } from './features/search/hooks/useCrossFileSearch';
import { useAppKeyboardShortcuts } from './features/app-shell/hooks/useAppKeyboardShortcuts';
import { AppMenus } from './features/app-shell/components/AppMenus';
import { AppOnboardingOverlay } from './features/app-shell/components/AppOnboardingOverlay';
import { AppWorkspace } from './features/app-shell/components/AppWorkspace';
import { findContainingLocation } from './features/saved-locations/savedLocations';
import { useSavedLocationsController } from './features/saved-locations/hooks/useSavedLocationsController';
import {
	confirmDeleteTarget,
	entryToContextTarget,
	pathIsDeletedTarget,
} from './features/explorer/utils/contextTargets';
import { useInlineDraftController } from './features/explorer/hooks/useInlineDraftController';
import './App.css';

// Run a built-in editing command (undo/redo/cut/copy/paste) on the focused
// editor. document.execCommand is formally deprecated, but inside a
// contentEditable it remains the only API that performs these actions from a
// programmatic trigger — synthetic keyboard events are untrusted and won't drive
// the webview's native clipboard/history, and an Electron-style native menu role
// (how VS Code does this) isn't available under Tauri. The existing markdown
// editor already relies on execCommand for the same reason. The cast keeps the
// deprecation off the call site without disabling type-checking.
const execEditCommand = document.execCommand.bind(document) as (
	commandId: string,
	showUI?: boolean,
	value?: string
) => boolean;

function App() {
	const initialConfiguration = useMemo(() => loadAppConfiguration(), []);
	const initialSession = useMemo(() => loadAppSession(), []);
	const [defaultLocs, setDefaultLocs] = useState<Entry[]>([]);
	const [activeRoot, setActiveRoot] = useState<Entry | null>(null);
	const [expanded, setExpanded] = useState<Set<string>>(
		() => new Set(initialSession.expandedPaths)
	);
	const [childrenCache, setChildrenCache] = useState<Record<string, Entry[]>>({});
	const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
	const [error, setError] = useState<string | null>(null);
	const [explorerHidden, setExplorerHidden] = useState(
		() => initialConfiguration.explorerHidden ?? false
	);
	const [outlinePanelVisible, setOutlinePanelVisible] = useState(
		() => initialConfiguration.outlinePanelVisible ?? false
	);
	const { sidebarWidth, startSidebarResize } = useSidebarResize(
		initialConfiguration.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH
	);
	const [mode, setMode] = useState<FileViewMode>(() => initialConfiguration.viewMode ?? 'preview');
	const [pendingFormatAction, setPendingFormatAction] = useState<{
		action: MarkdownAction;
		id: number;
	} | null>(null);
	const [barMerged, setBarMerged] = useState(() => initialConfiguration.barMerged ?? false);
	const [theme, setTheme] = useState<AppTheme>(() => initialConfiguration.theme ?? 'dark');
	const [explorerHeaderActionsVisible, setExplorerHeaderActionsVisible] =
		useState<ExplorerHeaderActionsVisibility>(
			() =>
				initialConfiguration.explorerHeaderActionsVisible ?? DEFAULT_EXPLORER_HEADER_ACTIONS_VISIBLE
		);
	const [sourcesHeaderActionsVisible, setSourcesHeaderActionsVisible] =
		useState<SourcesHeaderActionsVisibility>(
			() =>
				initialConfiguration.sourcesHeaderActionsVisible ?? DEFAULT_SOURCES_HEADER_ACTIONS_VISIBLE
		);
	const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(
		() =>
			initialSession.selectedFolderPath ??
			(initialSession.openFilePath ? parentPath(initialSession.openFilePath) : null)
	);
	const [windowFrame, setWindowFrame] = useState<StoredWindowFrame | undefined>(
		() => initialConfiguration.windowFrame
	);
	const [contextMenu, setContextMenu] = useState<ContextMenuTarget | null>(null);
	// When the context menu is opened from the Home screen, this captures the
	// variant (trimmed action set) and the recent item it refers to (for the
	// "Remove from Recent" action). null = opened from the explorer.
	const [contextMenuVariant, setContextMenuVariant] = useState<ContextMenuVariant>('explorer');
	const [contextMenuRecent, setContextMenuRecent] = useState<RecentItem | null>(null);
	const [savedMenu, setSavedMenu] = useState<{
		location: Entry;
		x: number;
		y: number;
	} | null>(null);
	const [explorerHeaderMenu, setExplorerHeaderMenu] = useState<{
		x: number;
		y: number;
	} | null>(null);
	const [sourcesHeaderMenu, setSourcesHeaderMenu] = useState<{
		x: number;
		y: number;
	} | null>(null);
	const [iconPicker, setIconPicker] = useState<{
		location: Entry;
		x: number;
		y: number;
	} | null>(null);
	// Which overlay screen (if any) is showing. "onboarding" forces the setup
	// flow; "home" is the default landing until the user opens a file/root.
	// null = the normal preview/editor workspace.
	const [overlay, setOverlay] = useState<'onboarding' | 'home' | null>(
		initialConfiguration.onboardingCompleted ? 'home' : 'onboarding'
	);
	const [focusedEntry, setFocusedEntry] = useState<Entry | null>(null);
	const [sidebarMode, setSidebarMode] = useState<SidebarMode>('explorer');
	const [sessionHydrated, setSessionHydrated] = useState(false);
	const findTargetRef = useRef<HTMLElement | null>(null);
	const closeFindAfterOpenRef = useRef<(() => void) | null>(null);
	const openFileAtPathRef = useRef<
		| ((path: string, options?: { mode?: FileViewMode; skipRecent?: boolean }) => Promise<void>)
		| null
	>(null);
	const pendingFindQueryRef = useRef<string | null>(null);
	const savedLocations = useSavedLocationsController({
		activeRoot,
		defaultLocations: defaultLocs,
		initialConfiguration,
		onActiveRootChange: setActiveRoot,
		onError: setError,
		onExpandedChange: setExpanded,
		onOpenFileAtPath: (path, options) =>
			openFileAtPathRef.current?.(path, options) ?? Promise.resolve(),
		onOverlayChange: setOverlay,
		onSelectLocation: selectLocation,
		onViewModeChange: setMode,
	});
	const {
		homePath,
		isPinnable,
		isUnpinnable,
		locationIcons,
		locations,
		onboardingCompleted,
		pinnedLocations,
		recents,
		removedDefaultPaths,
		userName,
		setRecents,
		applyLocationIcon,
		completeOnboarding,
		openFolderAsRoot,
		openRecent,
		pinFolder,
		recordFileRecent,
		removeRecentItem,
		skipOnboarding,
		touchRootRecent,
		toggleRootPin,
		unpinLocation,
	} = savedLocations;
	const {
		dirty,
		openFile,
		openFilePath,
		renderedMarkdown,
		saving,
		setOpenFile,
		setOpenFilePath,
		unsavedFileDrafts,
		unsavedFileDraftsRef,
		updateUnsavedFileDrafts,
		openFileAtPath,
		saveOpenFile,
		updateOpenFileContent,
	} = useOpenFileController({
		activeRoot,
		afterOpenRef: closeFindAfterOpenRef,
		initialOpenFilePath: initialSession.openFilePath,
		onError: setError,
		onRecordFileRecent: recordFileRecent,
		onSelectedFolderPathChange: setSelectedFolderPath,
		onViewModeChange: setMode,
	});
	openFileAtPathRef.current = openFileAtPath;
	const configurationRef = useRef<AppConfigurationState>({
		explorerHidden,
		outlinePanelVisible,
		sidebarWidth,
		barMerged,
		viewMode: mode,
		theme,
		explorerHeaderActionsVisible,
		sourcesHeaderActionsVisible,
		windowFrame,
		pinnedLocations,
		removedDefaultPaths,
		locationIcons,
		onboardingCompleted,
		userName,
		recents,
	});
	const { isMaximized } = useWindowFramePersistence({
		initialFrame: initialConfiguration.windowFrame,
		configurationRef,
		unsavedFileDraftsRef,
		onFrameChange: setWindowFrame,
	});

	useThemeClass(theme);

	function getCreateTargetFolder() {
		return (
			selectedFolderPath ??
			(openFilePath ? parentPath(openFilePath) : null) ??
			activeRoot?.path ??
			null
		);
	}

	const findContentKey =
		mode === 'preview' && openFile?.kind === 'md' ? renderedMarkdown : (openFile?.content ?? '');
	const find = useFindInPreview(findTargetRef, `${openFile?.path ?? ''}:${mode}:${findContentKey}`);
	closeFindAfterOpenRef.current = find.close;

	useEffect(() => {
		const query = pendingFindQueryRef.current;
		if (!query || mode !== 'preview') {
			return;
		}

		const frame = window.requestAnimationFrame(() => {
			find.openWithQuery(query);
			pendingFindQueryRef.current = null;
		});

		return () => window.cancelAnimationFrame(frame);
	}, [find, mode, openFile?.path, renderedMarkdown]);

	useEffect(() => {
		const nextConfiguration: AppConfigurationState = {
			explorerHidden,
			outlinePanelVisible,
			sidebarWidth,
			barMerged,
			viewMode: mode,
			theme,
			explorerHeaderActionsVisible,
			sourcesHeaderActionsVisible,
			windowFrame,
			pinnedLocations,
			removedDefaultPaths,
			locationIcons,
			onboardingCompleted,
			userName,
			recents,
		};

		configurationRef.current = nextConfiguration;
		saveAppConfiguration(nextConfiguration);
	}, [
		barMerged,
		explorerHidden,
		outlinePanelVisible,
		mode,
		theme,
		explorerHeaderActionsVisible,
		sourcesHeaderActionsVisible,
		sidebarWidth,
		windowFrame,
		pinnedLocations,
		removedDefaultPaths,
		locationIcons,
		onboardingCompleted,
		userName,
		recents,
	]);

	useEffect(() => {
		if (!sessionHydrated) {
			return;
		}

		saveAppSession({
			activeRootPath: activeRoot?.path,
			selectedFolderPath: selectedFolderPath ?? undefined,
			openFilePath: openFilePath ?? undefined,
			expandedPaths: Array.from(expanded),
		});
	}, [activeRoot?.path, expanded, openFilePath, selectedFolderPath, sessionHydrated]);

	useEffect(() => {
		let cancelled = false;

		async function loadLocations() {
			try {
				const defaults = await defaultLocations();
				if (cancelled) {
					return;
				}

				setDefaultLocs(defaults);
				const restorable = [...defaults, ...(initialConfiguration.pinnedLocations ?? [])];
				const restoredRoot =
					restorable.find((location) => location.path === initialSession.activeRootPath) ??
					restorable.find((location) => location.path === initialSession.selectedFolderPath) ??
					findContainingLocation(restorable, initialSession.openFilePath) ??
					findContainingLocation(restorable, initialSession.selectedFolderPath) ??
					// Fall back to reconstructing the root from the saved path if it isn't
					// a pinned/default location (e.g. a folder opened via the native picker).
					(initialSession.activeRootPath
						? {
								name: fileName(initialSession.activeRootPath),
								path: initialSession.activeRootPath,
								is_dir: true,
								kind: 'folder' as const,
							}
						: null);
				const first = restoredRoot ?? defaults[0] ?? null;
				const restoredSelectedFolder =
					initialSession.selectedFolderPath ??
					(initialSession.openFilePath
						? parentPath(initialSession.openFilePath)
						: (first?.path ?? null));

				setActiveRoot(first);
				setSelectedFolderPath(restoredSelectedFolder);

				if (first) {
					await loadFolder(first.path);
					await Promise.all(
						initialSession.expandedPaths
							.filter((path) => path !== first.path)
							.map((path) => loadFolder(path, { quiet: true }))
					);
				}

				// The app always launches on the Home screen (or onboarding on first
				// run). The tree is pre-loaded above so the explorer is ready, but we
				// deliberately do NOT auto-open the last file: Home is the landing
				// place, and opening anything from Home or the explorer dismisses it.
			} catch (cause) {
				if (!cancelled) {
					setError(`Unable to load default locations: ${String(cause)}`);
				}
			} finally {
				if (!cancelled) {
					setSessionHydrated(true);
				}
			}
		}

		void loadLocations();

		return () => {
			cancelled = true;
		};
	}, []);

	async function loadFolder(path: string, options?: { quiet?: boolean; force?: boolean }) {
		if (childrenCache[path] && !options?.force) {
			return;
		}

		if (!options?.quiet) {
			setError(null);
		}
		setLoadingPaths((current) => new Set(current).add(path));

		try {
			const children = await readFolder(path);
			setChildrenCache((current) => ({ ...current, [path]: children }));
		} catch (cause) {
			if (!options?.quiet) {
				setError(`Unable to read folder: ${String(cause)}`);
			}
		} finally {
			setLoadingPaths((current) => {
				const next = new Set(current);
				next.delete(path);
				return next;
			});
		}
	}

	// Re-read a folder from disk and refresh its cached children. The active root
	// is keyed by its own path in childrenCache, so this covers it too.
	async function refreshFolder(path: string) {
		await loadFolder(path, { force: true, quiet: true });
	}

	const { scrollToAnchor, handleLinkClick } = usePreviewNavigation({
		findTargetRef,
		mode,
		openFilePath,
		renderedMarkdown,
		openFileAtPath,
		onError: setError,
	});

	const {
		searchQuery,
		setSearchQuery,
		searchedQuery,
		searchResults,
		searchLoading,
		searchError,
		searchTruncated,
		runCrossFileSearch,
		openSearchResult,
		clearCrossFileSearch,
	} = useCrossFileSearch({
		activeRoot,
		openFileAtPath,
		pendingFindQueryRef,
	});

	const {
		beginInternalDrag,
		dropCount,
		dropState,
		internalDragState,
		rootDropActive,
		treeDropTargetPath,
	} = useAppDragDropController({
		activeRoot,
		childrenCache,
		expanded,
		loadingPaths,
		openFileAtPath,
		refreshFolder,
		selectLocation,
		loadFolder,
		onExpandedChange: setExpanded,
		onError: setError,
		onOverlayChange: setOverlay,
		onRecentsChange: setRecents,
	});
	const { draft, cancelDraft, startCreateDraft, startRenameDraft, submitDraft } =
		useInlineDraftController({
			activeRootPath: activeRoot?.path,
			expanded,
			openFilePath,
			loadFolder,
			refreshFolder,
			openFileAtPath,
			onError: setError,
			onExpandedChange: setExpanded,
			onFocusedEntryChange: setFocusedEntry,
			onOpenFileChange: setOpenFile,
			onOpenFilePathChange: setOpenFilePath,
			onUnsavedFileDraftsChange: updateUnsavedFileDrafts,
		});

	async function selectLocation(location: Entry) {
		setActiveRoot(location);
		setSelectedFolderPath(location.path);
		setOpenFile(null);
		setOpenFilePath(null);
		setExpanded(new Set());
		setError(null);
		setMode('preview');
		setOverlay(null);
		find.close();
		clearCrossFileSearch();
		touchRootRecent({ path: location.path, name: location.name });
		await loadFolder(location.path);
	}

	async function toggleFolder(entry: Entry) {
		const willExpand = !expanded.has(entry.path);
		setSelectedFolderPath(entry.path);
		setFocusedEntry(entry);

		setExpanded((current) => {
			const next = new Set(current);
			if (willExpand) {
				next.add(entry.path);
			} else {
				next.delete(entry.path);
			}
			return next;
		});

		if (willExpand) {
			await loadFolder(entry.path);
		}
	}

	async function selectFile(entry: Entry) {
		setFocusedEntry(entry);
		setOverlay(null);
		await openFileAtPath(entry.path);
	}

	function openEntryContextMenu(entry: Entry, event: ReactMouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		cancelDraft();
		setExplorerHeaderMenu(null);
		setSourcesHeaderMenu(null);
		setFocusedEntry(entry);
		setContextMenuVariant('explorer');
		setContextMenuRecent(null);
		setContextMenu(entryToContextTarget(entry, event.clientX, event.clientY));
	}

	// Right-click on a Recent item from the Home screen. Root recents use the
	// trimmed "recent-root" menu (remove, rename, delete, reveal, copy path); the
	// rootless "file" recent uses the "recent-file" menu and a file-kind target so
	// Open/reveal/delete act on the file itself.
	function openRecentContextMenu(item: RecentItem, event: ReactMouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		setExplorerHeaderMenu(null);
		setSourcesHeaderMenu(null);
		setSavedMenu(null);
		setContextMenuRecent(item);
		const isFile = recentItemKind(item) === 'file';
		setContextMenuVariant(isFile ? 'recent-file' : 'recent-root');
		setContextMenu({
			kind: isFile ? 'file' : 'folder',
			path: item.path,
			name: item.name,
			x: event.clientX,
			y: event.clientY,
		});
	}

	function openRootContextMenu(event: ReactMouseEvent) {
		if (!activeRoot) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		cancelDraft();
		setExplorerHeaderMenu(null);
		setSourcesHeaderMenu(null);
		setContextMenuVariant('explorer');
		setContextMenuRecent(null);
		setContextMenu({
			kind: 'folder',
			path: activeRoot.path,
			name: activeRoot.name,
			x: event.clientX,
			y: event.clientY,
		});
	}

	function openSavedContextMenu(location: Entry, event: ReactMouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		setContextMenu(null);
		setExplorerHeaderMenu(null);
		setSourcesHeaderMenu(null);
		setSavedMenu({ location, x: event.clientX, y: event.clientY });
	}

	function openExplorerHeaderContextMenu(event: ReactMouseEvent) {
		if (!activeRoot) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		cancelDraft();
		setContextMenu(null);
		setContextMenuRecent(null);
		setContextMenuVariant('explorer');
		setSavedMenu(null);
		setSourcesHeaderMenu(null);
		setExplorerHeaderMenu({ x: event.clientX, y: event.clientY });
	}

	function openSourcesHeaderContextMenu(event: ReactMouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		cancelDraft();
		setContextMenu(null);
		setContextMenuRecent(null);
		setContextMenuVariant('explorer');
		setSavedMenu(null);
		setExplorerHeaderMenu(null);
		setSourcesHeaderMenu({ x: event.clientX, y: event.clientY });
	}

	function toggleExplorerHeaderAction(action: keyof ExplorerHeaderActionsVisibility) {
		setExplorerHeaderActionsVisible((current) => ({
			...current,
			[action]: !current[action],
		}));
	}

	function toggleSourcesHeaderAction(action: keyof SourcesHeaderActionsVisibility) {
		setSourcesHeaderActionsVisible((current) => ({
			...current,
			[action]: !current[action],
		}));
	}

	async function handleExplorerHeaderMenuAction(action: ExplorerHeaderMenuAction) {
		setExplorerHeaderMenu(null);
		const targetFolder = getCreateTargetFolder();

		try {
			switch (action) {
				case 'new-file':
					if (targetFolder) {
						await startCreateDraft(targetFolder, 'file');
					}
					break;
				case 'new-folder':
					if (targetFolder) {
						await startCreateDraft(targetFolder, 'folder');
					}
					break;
				case 'refresh':
					if (activeRoot) {
						await refreshFolder(activeRoot.path);
					}
					break;
				case 'toggle-new-file':
					toggleExplorerHeaderAction('newFile');
					break;
				case 'toggle-new-folder':
					toggleExplorerHeaderAction('newFolder');
					break;
				case 'toggle-refresh':
					toggleExplorerHeaderAction('refresh');
					break;
				default:
					break;
			}
		} catch (cause) {
			setError(`${String(cause)}`);
		}
	}

	function handleSourcesHeaderMenuAction(action: SourcesHeaderMenuAction) {
		setSourcesHeaderMenu(null);

		switch (action) {
			case 'switch-explorer':
				setSidebarMode('explorer');
				break;
			case 'switch-search':
				setSidebarMode('search');
				break;
			case 'switch-outline':
				setSidebarMode('outline');
				break;
			case 'toggle-root-pin':
				toggleRootPin();
				break;
			case 'open-folder':
				void openFolderAsRoot();
				break;
			case 'toggle-search':
				toggleSourcesHeaderAction('search');
				break;
			case 'toggle-outline':
				toggleSourcesHeaderAction('outline');
				break;
			case 'toggle-pin':
				toggleSourcesHeaderAction('pin');
				break;
			default:
				break;
		}
	}

	async function handleSavedAction(action: SavedMenuAction, location: Entry) {
		if (action === 'change-icon') {
			// Keep the saved menu position to anchor the picker near it.
			const menu = savedMenu;
			setSavedMenu(null);
			if (menu) {
				setIconPicker({ location, x: menu.x + 240, y: menu.y });
			}
			return;
		}

		setSavedMenu(null);

		try {
			switch (action) {
				case 'reveal':
					await revealInExplorer(location.path);
					break;
				case 'copy-path':
					await navigator.clipboard?.writeText(location.path);
					break;
				case 'copy-relative-path':
					await navigator.clipboard?.writeText(
						activeRoot ? relativePath(activeRoot.path, location.path) : location.path
					);
					break;
				case 'unpin':
					unpinLocation(location);
					break;
				default:
					break;
			}
		} catch (cause) {
			setError(`${String(cause)}`);
		}
	}

	async function handleContextAction(action: ContextMenuAction, target: ContextMenuTarget) {
		setContextMenu(null);
		const recentForAction = contextMenuRecent;
		setContextMenuRecent(null);
		setContextMenuVariant('explorer');

		try {
			switch (action) {
				case 'remove-recent':
					if (recentForAction) {
						removeRecentItem(recentForAction);
					}
					break;
				case 'open':
					if (target.kind === 'file') {
						await openFileAtPath(target.path);
					}
					break;
				case 'new-file':
					await startCreateDraft(target.path, 'file');
					break;
				case 'new-folder':
					await startCreateDraft(target.path, 'folder');
					break;
				case 'pin':
					pinFolder({
						name: target.name,
						path: target.path,
						is_dir: true,
						kind: 'folder',
					});
					break;
				case 'rename':
					startRenameDraft({
						name: target.name,
						path: target.path,
						is_dir: target.kind === 'folder',
						kind: target.kind === 'folder' ? 'folder' : fileKindFromPath(target.path),
					});
					break;
				case 'reveal':
					await revealInExplorer(target.path);
					break;
				case 'copy-path':
					await navigator.clipboard?.writeText(target.path);
					break;
				case 'copy-relative-path':
					await navigator.clipboard?.writeText(
						activeRoot ? relativePath(activeRoot.path, target.path) : target.path
					);
					break;
				case 'delete': {
					const confirmed = await confirmDeleteTarget(target);
					if (!confirmed) {
						break;
					}

					await deletePath(target.path);

					if (pathIsDeletedTarget(target, openFilePath)) {
						setOpenFile(null);
						setOpenFilePath(null);
					}
					updateUnsavedFileDrafts((current) => {
						const next: UnsavedFileDrafts = {};
						Object.entries(current).forEach(([key, draft]) => {
							if (!pathIsDeletedTarget(target, draft.path)) {
								next[key] = draft;
							}
						});
						return next;
					});
					setSelectedFolderPath((current) =>
						pathIsDeletedTarget(target, current) ? parentPath(target.path) : current
					);
					setFocusedEntry((current) =>
						pathIsDeletedTarget(target, current?.path) ? null : current
					);
					setExpanded((current) => {
						const next = new Set<string>();
						current.forEach((path) => {
							if (!pathIsDeletedTarget(target, path)) {
								next.add(path);
							}
						});
						return next;
					});
					setChildrenCache((current) => {
						const next: Record<string, Entry[]> = {};
						Object.entries(current).forEach(([path, entries]) => {
							if (!pathIsDeletedTarget(target, path)) {
								next[path] = entries;
							}
						});
						return next;
					});

					// Update recents: drop any root whose folder was deleted, and clear
					// the lastFile of any root whose recorded file was deleted.
					setRecents((current) =>
						current
							.filter((item) => !pathIsDeletedTarget(target, item.path))
							.map((item) =>
								item.lastFile && pathIsDeletedTarget(target, item.lastFile.path)
									? { ...item, lastFile: undefined }
									: item
							)
					);

					if (pathIsDeletedTarget(target, activeRoot?.path)) {
						const fallbackRoot =
							locations.find((location) => !pathIsDeletedTarget(target, location.path)) ?? null;
						setActiveRoot(fallbackRoot);
						setSelectedFolderPath(fallbackRoot?.path ?? null);
						if (fallbackRoot) {
							await loadFolder(fallbackRoot.path, { force: true });
						}
					} else {
						await refreshFolder(parentPath(target.path));
					}
					break;
				}
				default:
					break;
			}
		} catch (cause) {
			setError(`${String(cause)}`);
		}
	}

	// Dispatch a menu-bar action to the matching existing handler. Edit clipboard
	// / history actions defer to the browser's built-in commands so they behave
	// exactly like the native Ctrl+Z / Ctrl+X / … keybinds on the focused editor.
	const handleMenuAction = useCallback(
		(id: string) => {
			const targetFolder = selectedFolderPath ?? activeRoot?.path ?? null;

			switch (id) {
				case 'new-file':
					if (targetFolder) {
						void startCreateDraft(targetFolder, 'file');
					}
					return;
				case 'new-folder':
					if (targetFolder) {
						void startCreateDraft(targetFolder, 'folder');
					}
					return;
				case 'open-folder':
					void openFolderAsRoot();
					return;
				case 'save':
					void saveOpenFile();
					return;
				case 'reveal':
					if (openFilePath) {
						void revealInExplorer(openFilePath);
					}
					return;
				case 'find':
					if (openFile) {
						find.setOpen(true);
					}
					return;
				case 'find-in-files':
					setExplorerHidden(false);
					setSidebarMode('search');
					return;
				case 'toggle-explorer':
					setExplorerHidden((hidden) => !hidden);
					return;
				case 'toggle-outline-panel':
					setOutlinePanelVisible((visible) => !visible);
					return;
				case 'mode-preview':
					setMode('preview');
					return;
				case 'mode-edit':
					setMode('edit');
					return;
				case 'mode-code':
					setMode('code');
					return;
				case 'toggle-bar':
					setBarMerged((merged) => !merged);
					return;
				case 'toggle-theme':
					setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
					return;
				// Editor clipboard / history — run the webview's built-in editing
				// commands on the focused editor (see execEditCommand above).
				case 'undo':
					execEditCommand('undo');
					return;
				case 'redo':
					execEditCommand('redo');
					return;
				case 'cut':
					execEditCommand('cut');
					return;
				case 'copy':
					execEditCommand('copy');
					return;
				case 'paste':
					// execCommand("paste") is a no-op in some engines; fall back to the
					// async Clipboard API and insert the text at the caret.
					if (!execEditCommand('paste')) {
						void navigator.clipboard
							?.readText()
							.then((text) => execEditCommand('insertText', false, text))
							.catch(() => undefined);
					}
					return;
				default:
					return;
			}
		},
		[activeRoot?.path, find, openFile, openFilePath, saveOpenFile, selectedFolderPath]
	);

	const menuState = useMemo(
		() => ({
			hasOpenFile: Boolean(openFile),
			dirty,
			isMarkdown: openFile?.kind === 'md',
			isEditing: mode === 'edit' || mode === 'code',
			canCopy: Boolean(openFile),
			explorerHidden,
			outlinePanelVisible,
			barMerged,
			theme,
			mode,
		}),
		[openFile, dirty, mode, explorerHidden, outlinePanelVisible, barMerged, theme]
	);

	const title = openFile?.name ?? activeRoot?.name ?? 'Markdown Viewer';
	// Show the open file's parent folder as a middle crumb, but only when it
	// isn't the root itself (otherwise the root name would appear twice).
	const breadcrumbScope =
		openFile &&
		activeRoot &&
		comparablePath(parentPath(openFile.path)) !== comparablePath(activeRoot.path)
			? parentName(openFile.path)
			: null;
	const rootChildren = activeRoot ? childrenCache[activeRoot.path] : undefined;
	const unsavedFilePathKeys = new Set(
		Object.values(unsavedFileDrafts).map((file) => comparablePath(file.path))
	);
	const { fileActionControls, previewActionBar } = useAppFileActionSlots({
		openFile,
		dirty,
		findOpen: find.open,
		merged: barMerged,
		mode,
		saving,
		onModeChange: setMode,
		onSave: () => void saveOpenFile(),
		onToggleFind: find.toggle,
		onToggleMerged: () => setBarMerged((merged) => !merged),
		onFormatAction: (action) =>
			setPendingFormatAction((current) => ({
				action,
				id: (current?.id ?? 0) + 1,
			})),
	});

	useAppKeyboardShortcuts({
		draft,
		find,
		focusedEntry,
		onFindInFiles: () => {
			setExplorerHidden(false);
			setSidebarMode('search');
		},
		onSave: () => void saveOpenFile(),
		onContextAction: (action, target) => void handleContextAction(action, target),
		onToggleFolder: (entry) => void toggleFolder(entry),
	});
	return (
		<div
			className={`app-window ${explorerHidden ? 'explorer-hidden' : ''} ${isMaximized ? 'fullscreen' : ''} ${theme === 'light' ? 'theme-light' : ''} ${overlay ? 'overlay-active' : ''}`}
		>
			<AppWorkspace
				shell={{
					activeRoot,
					barMerged,
					breadcrumbScope,
					explorerHidden,
					fileActionsSlot: fileActionControls,
					menuState,
					overlay,
					title,
					onMenuAction: handleMenuAction,
					onToggleExplorer: () => setExplorerHidden((hidden) => !hidden),
				}}
				sidebar={{
					activeFilePath: openFilePath ?? undefined,
					activeRoot,
					beginInternalDrag,
					childrenCache,
					contextPath: contextMenu?.path,
					draft,
					expanded,
					explorerHeaderActionsVisible,
					focusedPath: focusedEntry?.path ?? undefined,
					homePath,
					loadingPaths,
					locations,
					locationIcons,
					mode: sidebarMode,
					rootChildren,
					rootDropActive,
					rootPinned: activeRoot ? !isPinnable(activeRoot.path) : false,
					rootPinDisabled: !activeRoot || !isUnpinnable(activeRoot),
					search: {
						query: searchQuery,
						searchedQuery,
						results: searchResults,
						loading: searchLoading,
						error: searchError,
						truncated: searchTruncated,
						onQueryChange: setSearchQuery,
						onClear: clearCrossFileSearch,
						onSubmit: () => {
							setSidebarMode('search');
							void runCrossFileSearch();
						},
						onOpenResult: (result) => void openSearchResult(result),
					},
					selectedFolderPath: selectedFolderPath ?? undefined,
					sidebarWidth,
					sourcesHeaderActionsVisible,
					theme,
					treeDropTargetPath,
					unsavedFilePathKeys,
					onCreateRootFile: () => {
						const targetFolder = getCreateTargetFolder();
						if (targetFolder) {
							void startCreateDraft(targetFolder, 'file');
						}
					},
					onCreateRootFolder: () => {
						const targetFolder = getCreateTargetFolder();
						if (targetFolder) {
							void startCreateDraft(targetFolder, 'folder');
						}
					},
					onDraftCancel: cancelDraft,
					onDraftSubmit: submitDraft,
					onEntryContextMenu: openEntryContextMenu,
					onExplorerHeaderContextMenu: openExplorerHeaderContextMenu,
					onOpenFolder: () => void openFolderAsRoot(),
					onRefreshRoot: () => {
						if (activeRoot) {
							void refreshFolder(activeRoot.path);
						}
					},
					onRootContextMenu: openRootContextMenu,
					onSavedContextMenu: openSavedContextMenu,
					onSelectFile: selectFile,
					onSelectHeading: (id) => scrollToAnchor(id),
					onSelectLocation: selectLocation,
					onSidebarModeChange: setSidebarMode,
					onSourcesHeaderContextMenu: openSourcesHeaderContextMenu,
					onToggleFolder: toggleFolder,
					onToggleRootPin: toggleRootPin,
					onToggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
				}}
				home={{
					dropActive: dropState.target?.kind === 'home',
					homePath,
					locationIcons,
					locations,
					recents,
					userName,
					onEditSetup: () => setOverlay('onboarding'),
					onLocationContextMenu: openSavedContextMenu,
					onOpenFolder: () => void openFolderAsRoot(),
					onOpenRecent: (item) => void openRecent(item),
					onRecentContextMenu: openRecentContextMenu,
					onSelectLocation: (location) => void selectLocation(location),
				}}
				preview={{
					actionBar: previewActionBar,
					dropCount,
					dropState,
					error,
					find,
					findTargetRef,
					mode,
					openFile,
					outlinePanelVisible,
					pendingFormatAction,
					renderedMarkdown,
					onContentChange: updateOpenFileContent,
					onLinkClick: (href) => void handleLinkClick(href),
					onSelectHeading: (id) => scrollToAnchor(id),
				}}
				resize={{ onPointerDown: startSidebarResize }}
			/>

			<AppOnboardingOverlay
				visible={overlay === 'onboarding'}
				defaultHomeName={defaultLocs[0]?.name}
				homePath={homePath}
				locations={locations}
				userName={userName}
				viewMode={mode}
				onboardingCompleted={onboardingCompleted}
				onPickFolder={pickFolder}
				onComplete={completeOnboarding}
				onSkip={skipOnboarding}
			/>

			<DragLayer state={internalDragState} />
			<TreeDropBadge
				target={dropState.target}
				hint={dropState.renderHint}
				mode={dropState.mode}
				count={dropCount}
			/>

			<AppMenus
				context={{
					target: contextMenu,
					variant: contextMenuVariant,
					canPin:
						contextMenuVariant === 'explorer' &&
						contextMenu?.kind === 'folder' &&
						isPinnable(contextMenu.path),
					onAction: (action, target) => void handleContextAction(action, target),
					onClose: () => {
						setContextMenu(null);
						setContextMenuRecent(null);
						setContextMenuVariant('explorer');
					},
				}}
				explorerHeader={{
					menu: explorerHeaderMenu,
					visibleActions: explorerHeaderActionsVisible,
					onAction: (action) => void handleExplorerHeaderMenuAction(action),
					onClose: () => setExplorerHeaderMenu(null),
				}}
				sourcesHeader={{
					menu: sourcesHeaderMenu,
					visibleActions: sourcesHeaderActionsVisible,
					showOutlineAction: !outlinePanelVisible,
					rootPinned: activeRoot ? !isPinnable(activeRoot.path) : false,
					rootPinDisabled: !activeRoot || !isUnpinnable(activeRoot),
					onAction: handleSourcesHeaderMenuAction,
					onClose: () => setSourcesHeaderMenu(null),
				}}
				saved={{
					menu: savedMenu,
					canUnpin: isUnpinnable,
					onAction: (action, location) => void handleSavedAction(action, location),
					onClose: () => setSavedMenu(null),
				}}
				iconPicker={{
					menu: iconPicker,
					currentIcon: iconPicker ? locationIcons[iconPicker.location.path] : undefined,
					onSelect: (iconName) => {
						if (iconPicker) {
							applyLocationIcon(iconPicker.location, iconName);
						}
					},
					onClose: () => setIconPicker(null),
				}}
			/>
		</div>
	);
}

export default App;
