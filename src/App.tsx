import { useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { pickFolder } from './features/files/api/filesApi';
import { useSidebarResize } from './features/explorer/hooks/useSidebarResize';
import type { FileViewMode } from './features/file-actions/components/FileActionControls';
import { useAppFileActionSlots } from './features/file-actions/components/AppFileActionSlots';
import { useFindInPreview } from './features/file-actions/hooks/useFindInPreview';
import { usePreviewNavigation } from './features/preview/hooks/usePreviewNavigation';
import { useOpenFileController } from './features/files/hooks/useOpenFileController';
import { useAppDragDropController } from './features/dnd/useAppDragDropController';
import { DragLayer } from './features/dnd/DragLayer';
import { TreeDropBadge } from './features/dnd/TreeDropBadge';
import type { Entry } from './shared/types/files';
import { comparablePath, parentName, parentPath } from './shared/utils/path';
import {
	recentItemKind,
	type AppConfigurationState,
	type RecentItem,
} from './shared/state/persistence';
import { useCrossFileSearch } from './features/search/hooks/useCrossFileSearch';
import { useAppKeyboardShortcuts } from './features/app-shell/hooks/useAppKeyboardShortcuts';
import { useAppBootstrap } from './features/app-shell/hooks/useAppBootstrap';
import { useHeaderMenuActions } from './features/app-shell/hooks/useHeaderMenuActions';
import { useAppMenuActions } from './features/app-shell/hooks/useAppMenuActions';
import { useAppPersistence } from './features/app-shell/hooks/useAppPersistence';
import { useInitialLocations } from './features/app-shell/hooks/useInitialLocations';
import { AppMenus } from './features/app-shell/components/AppMenus';
import { AppOnboardingOverlay } from './features/app-shell/components/AppOnboardingOverlay';
import { AppWorkspace } from './features/app-shell/components/AppWorkspace';
import { useSavedLocationsController } from './features/saved-locations/hooks/useSavedLocationsController';
import { useSavedLocationMenuActions } from './features/saved-locations/hooks/useSavedLocationMenuActions';
import { entryToContextTarget } from './features/explorer/utils/contextTargets';
import { useInlineDraftController } from './features/explorer/hooks/useInlineDraftController';
import { useFolderTreeController } from './features/explorer/hooks/useFolderTreeController';
import { useExplorerContextActions } from './features/explorer/hooks/useExplorerContextActions';
import { selectUiConfiguration, useUiStore } from './features/app-shell/state/useUiStore';
import { selectExplorerTree, useExplorerStore } from './features/explorer/state/useExplorerStore';
import {
	selectSavedConfiguration,
	useSavedLocationsStore,
} from './features/saved-locations/state/useSavedLocationsStore';
import { selectMenuTargets, useMenuStore } from './features/app-shell/state/useMenuStore';
import './App.css';

type AppContextMenuRequest =
	| { kind: 'entry'; entry: Entry }
	| { kind: 'recent'; item: RecentItem }
	| { kind: 'root' }
	| { kind: 'saved'; location: Entry }
	| { kind: 'explorer-header' }
	| { kind: 'sources-header' };

function App() {
	const { initialConfiguration, initialSession } = useAppBootstrap();

	const {
		activeRoot,
		childrenCache,
		defaultLocs,
		error,
		expanded,
		focusedEntry,
		loadingPaths,
		selectedFolderPath,
	} = useExplorerStore(useShallow(selectExplorerTree));
	const setActiveRoot = useExplorerStore((state) => state.setActiveRoot);
	const setError = useExplorerStore((state) => state.setError);
	const setExpanded = useExplorerStore((state) => state.setExpanded);
	const setFocusedEntry = useExplorerStore((state) => state.setFocusedEntry);
	const setSelectedFolderPath = useExplorerStore((state) => state.setSelectedFolderPath);

	const {
		barMerged,
		explorerHeaderActionsVisible,
		explorerHidden,
		mode,
		outlinePanelVisible,
		overlay,
		pendingFormatAction,
		sidebarMode,
		sidebarWidth,
		sourcesHeaderActionsVisible,
		theme,
	} = useUiStore(
		useShallow((state) => ({
			barMerged: state.barMerged,
			explorerHeaderActionsVisible: state.explorerHeaderActionsVisible,
			explorerHidden: state.explorerHidden,
			mode: state.mode,
			outlinePanelVisible: state.outlinePanelVisible,
			overlay: state.overlay,
			pendingFormatAction: state.pendingFormatAction,
			sidebarMode: state.sidebarMode,
			sidebarWidth: state.sidebarWidth,
			sourcesHeaderActionsVisible: state.sourcesHeaderActionsVisible,
			theme: state.theme,
		}))
	);
	const setBarMerged = useUiStore((state) => state.setBarMerged);
	const setExplorerHidden = useUiStore((state) => state.setExplorerHidden);
	const setMode = useUiStore((state) => state.setMode);
	const setOverlay = useUiStore((state) => state.setOverlay);
	const setPendingFormatAction = useUiStore((state) => state.setPendingFormatAction);
	const setSidebarMode = useUiStore((state) => state.setSidebarMode);
	const setSidebarWidth = useUiStore((state) => state.setSidebarWidth);
	const setTheme = useUiStore((state) => state.setTheme);
	const { startSidebarResize } = useSidebarResize(sidebarWidth, setSidebarWidth);

	const { contextMenu, contextMenuVariant } = useMenuStore(useShallow(selectMenuTargets));
	const openContextMenuStore = useMenuStore((state) => state.openContextMenu);
	const openExplorerHeaderMenuStore = useMenuStore((state) => state.openExplorerHeaderMenu);
	const openSavedMenuStore = useMenuStore((state) => state.openSavedMenu);
	const openSourcesHeaderMenuStore = useMenuStore((state) => state.openSourcesHeaderMenu);
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
		recents,
		userName,
		setRecents,
		applyLocationIcon,
		completeOnboarding,
		openFolderAsRoot,
		openRecent,
		pinFolder,
		recordFileRecent,
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
	const { getCreateTargetFolder, loadFolder, refreshFolder, selectFile, toggleFolder } =
		useFolderTreeController({ openFileAtPath });
	const configurationRef = useRef<AppConfigurationState>({
		...selectUiConfiguration(useUiStore.getState()),
		...selectSavedConfiguration(useSavedLocationsStore.getState()),
	});
	const { isMaximized } = useAppPersistence({
		initialFrame: initialConfiguration.windowFrame,
		configurationRef,
		theme,
		unsavedFileDraftsRef,
	});

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

	useInitialLocations({ initialConfiguration, initialSession, loadFolder });

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
	const handleContextAction = useExplorerContextActions({
		locations,
		loadFolder,
		openFileAtPath,
		pinFolder,
		refreshFolder,
		startCreateDraft,
		startRenameDraft,
	});
	const { handleMenuAction, menuState } = useAppMenuActions({
		find,
		openFolderAsRoot,
		saveOpenFile,
		startCreateDraft,
	});
	const { handleExplorerHeaderMenuAction, handleSourcesHeaderMenuAction } = useHeaderMenuActions({
		getCreateTargetFolder,
		openFolderAsRoot,
		refreshFolder,
		startCreateDraft,
		toggleRootPin,
	});
	const { handleIconSelect, handleSavedAction } = useSavedLocationMenuActions({
		applyLocationIcon,
		unpinLocation,
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

	function openAppContextMenu(request: AppContextMenuRequest, event: ReactMouseEvent) {
		event.preventDefault();
		event.stopPropagation();

		switch (request.kind) {
			case 'entry':
				cancelDraft();
				setFocusedEntry(request.entry);
				openContextMenuStore(entryToContextTarget(request.entry, event.clientX, event.clientY));
				break;
			case 'recent': {
				const isFile = recentItemKind(request.item) === 'file';
				openContextMenuStore(
					{
						kind: isFile ? 'file' : 'folder',
						path: request.item.path,
						name: request.item.name,
						x: event.clientX,
						y: event.clientY,
					},
					{ variant: isFile ? 'recent-file' : 'recent-root', recent: request.item }
				);
				break;
			}
			case 'root':
				if (activeRoot) {
					cancelDraft();
					openContextMenuStore({
						kind: 'folder',
						path: activeRoot.path,
						name: activeRoot.name,
						x: event.clientX,
						y: event.clientY,
					});
				}
				break;
			case 'saved':
				openSavedMenuStore({
					location: request.location,
					x: event.clientX,
					y: event.clientY,
				});
				break;
			case 'explorer-header':
				if (activeRoot) {
					cancelDraft();
					openExplorerHeaderMenuStore({ x: event.clientX, y: event.clientY });
				}
				break;
			case 'sources-header':
				cancelDraft();
				openSourcesHeaderMenuStore({ x: event.clientX, y: event.clientY });
				break;
			default:
				break;
		}
	}

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
					onEntryContextMenu: (entry, event) => openAppContextMenu({ kind: 'entry', entry }, event),
					onExplorerHeaderContextMenu: (event) =>
						openAppContextMenu({ kind: 'explorer-header' }, event),
					onOpenFolder: () => void openFolderAsRoot(),
					onRefreshRoot: () => {
						if (activeRoot) {
							void refreshFolder(activeRoot.path);
						}
					},
					onRootContextMenu: (event) => openAppContextMenu({ kind: 'root' }, event),
					onSavedContextMenu: (location, event) =>
						openAppContextMenu({ kind: 'saved', location }, event),
					onSelectFile: selectFile,
					onSelectHeading: (id) => scrollToAnchor(id),
					onSelectLocation: selectLocation,
					onSidebarModeChange: setSidebarMode,
					onSourcesHeaderContextMenu: (event) =>
						openAppContextMenu({ kind: 'sources-header' }, event),
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
					onLocationContextMenu: (location, event) =>
						openAppContextMenu({ kind: 'saved', location }, event),
					onOpenFolder: () => void openFolderAsRoot(),
					onOpenRecent: (item) => void openRecent(item),
					onRecentContextMenu: (item, event) => openAppContextMenu({ kind: 'recent', item }, event),
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
					canPin:
						contextMenuVariant === 'explorer' &&
						contextMenu?.kind === 'folder' &&
						isPinnable(contextMenu.path),
					onAction: (action, target) => void handleContextAction(action, target),
				}}
				explorerHeader={{
					visibleActions: explorerHeaderActionsVisible,
					onAction: (action) => void handleExplorerHeaderMenuAction(action),
				}}
				sourcesHeader={{
					visibleActions: sourcesHeaderActionsVisible,
					showOutlineAction: !outlinePanelVisible,
					rootPinned: activeRoot ? !isPinnable(activeRoot.path) : false,
					rootPinDisabled: !activeRoot || !isUnpinnable(activeRoot),
					onAction: handleSourcesHeaderMenuAction,
				}}
				saved={{
					canUnpin: isUnpinnable,
					onAction: (action, location) => void handleSavedAction(action, location),
				}}
				iconPicker={{
					onSelect: handleIconSelect,
				}}
			/>
		</div>
	);
}

export default App;
