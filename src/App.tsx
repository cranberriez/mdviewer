import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ComponentProps } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { pickFolder } from './features/files/api/filesApi';
import { useSidebarResize } from './features/explorer/hooks/useSidebarResize';
import { useAppFileActionSlots } from './features/file-actions/components/AppFileActionSlots';
import { useFindInPreview } from './features/file-actions/hooks/useFindInPreview';
import type { MarkdownAction } from './features/preview/markdownActions';
import { usePreviewNavigation } from './features/preview/hooks/usePreviewNavigation';
import { useAppDragDropController } from './features/dnd/useAppDragDropController';
import { DragLayer } from './features/dnd/DragLayer';
import { TreeDropBadge } from './features/dnd/TreeDropBadge';
import { comparablePath, parentName, parentPath } from './shared/utils/path';
import type { AppConfigurationState } from './shared/state/persistence';
import { useCrossFileSearch } from './features/search/hooks/useCrossFileSearch';
import { useAppKeyboardShortcuts } from './features/app-shell/hooks/useAppKeyboardShortcuts';
import { useAppBootstrap } from './features/app-shell/hooks/useAppBootstrap';
import { useAppContextMenuRouter } from './features/app-shell/hooks/useAppContextMenuRouter';
import { useHeaderMenuActions } from './features/app-shell/hooks/useHeaderMenuActions';
import { useAppMenuActions } from './features/app-shell/hooks/useAppMenuActions';
import { useAppPersistence } from './features/app-shell/hooks/useAppPersistence';
import { useFileWorkspace } from './features/app-shell/hooks/useFileWorkspace';
import { useFindAfterOpen } from './features/app-shell/hooks/useFindAfterOpen';
import { useInitialLocations } from './features/app-shell/hooks/useInitialLocations';
import { useOpenWith } from './features/app-shell/hooks/useOpenWith';
import { AppMenus } from './features/app-shell/components/AppMenus';
import { AppOnboardingOverlay } from './features/app-shell/components/AppOnboardingOverlay';
import { AppWorkspace } from './features/app-shell/components/AppWorkspace';
import type { OnboardingResult } from './features/home/components/OnboardingView';
import { useSavedLocationMenuActions } from './features/saved-locations/hooks/useSavedLocationMenuActions';
import { useInlineDraftController } from './features/explorer/hooks/useInlineDraftController';
import { useExplorerFilterMenuController } from './features/explorer/hooks/useExplorerFilterMenuController';
import { useExplorerContextActions } from './features/explorer/hooks/useExplorerContextActions';
import {
	selectUiConfiguration,
	useUiActions,
	useUiStore,
} from './features/app-shell/state/useUiStore';
import {
	selectExplorerTree,
	useExplorerActions,
	useExplorerStore,
} from './features/explorer/state/useExplorerStore';
import {
	selectSavedConfiguration,
	useSavedLocationsStore,
} from './features/saved-locations/state/useSavedLocationsStore';
import { selectMenuTargets, useMenuStore } from './features/app-shell/state/useMenuStore';
import './App.css';

function App() {
	const { initialConfiguration, initialSession } = useAppBootstrap();

	useEffect(() => {
		const suppressBrowserContextMenu = (event: MouseEvent) => event.preventDefault();
		window.addEventListener('contextmenu', suppressBrowserContextMenu);
		return () => window.removeEventListener('contextmenu', suppressBrowserContextMenu);
	}, []);

	const {
		activeRoot,
		childrenCache,
		defaultLocs,
		error,
		expanded,
		focusedEntry,
		loadingPaths,
		selectedFolderPath,
		sessionHydrated,
	} = useExplorerStore(useShallow(selectExplorerTree));
	const { setError, setExpanded, setFocusedEntry } = useExplorerActions();

	const {
		barMerged,
		explorerHeaderActionsVisible,
		explorerHidden,
		mode,
		outlinePanelVisible,
		openHomeOnStartup,
		shellIntegration,
		overlay,
		pendingFormatAction,
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
			openHomeOnStartup: state.openHomeOnStartup,
			shellIntegration: state.shellIntegration,
			overlay: state.overlay,
			pendingFormatAction: state.pendingFormatAction,
			sidebarWidth: state.sidebarWidth,
			sourcesHeaderActionsVisible: state.sourcesHeaderActionsVisible,
			theme: state.theme,
		}))
	);
	const {
		setBarMerged,
		setExplorerHidden,
		setMode,
		setOpenHomeOnStartup,
		setOverlay,
		setPendingFormatAction,
		setSidebarMode,
		setSidebarWidth,
	} = useUiActions();
	const { startSidebarResize } = useSidebarResize(sidebarWidth, setSidebarWidth);

	const { contextMenu, contextMenuVariant } = useMenuStore(useShallow(selectMenuTargets));
	const findTargetRef = useRef<HTMLElement | null>(null);
	const {
		applyLocationIcon,
		completeOnboarding,
		dirty,
		getCreateTargetFolder,
		homePath,
		isPinnable,
		isUnpinnable,
		loadFolder,
		locationIcons,
		locations,
		onboardingCompleted,
		openFile,
		openFileAtPath,
		openFilePath,
		openFolderAsRoot,
		openExternalPath,
		openRecent,
		pinFolder,
		recents,
		refreshFolder,
		renderedMarkdown,
		saving,
		saveOpenFile,
		selectFile,
		selectLocation,
		setRecents,
		setOpenFile,
		setOpenFilePath,
		skipOnboarding,
		toggleFolder,
		toggleRootPin,
		unpinLocation,
		unsavedFileDrafts,
		unsavedFileDraftsRef,
		updateOpenFileContent,
		updateUnsavedFileDrafts,
		userName,
	} = useFileWorkspace({
		activeRoot,
		defaultLocations: defaultLocs,
		initialOpenFilePath: initialSession.openFilePath,
	});
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
	const { queueFindQueryAfterOpen } = useFindAfterOpen({
		find,
		mode,
		openFilePath,
		renderedMarkdown,
	});

	useInitialLocations({
		initialConfiguration,
		initialSession,
		loadFolder,
		openFileAtPath,
	});
	useOpenWith({ sessionHydrated, openExternalPath, onError: setError });

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
		onFindQueryPending: queueFindQueryAfterOpen,
		openFileAtPath,
	});

	useEffect(() => {
		clearCrossFileSearch();
	}, [activeRoot?.path, clearCrossFileSearch]);

	const handleSelectLocation = useCallback(
		async (location: Parameters<typeof selectLocation>[0]) => {
			clearCrossFileSearch();
			await selectLocation(location);
		},
		[clearCrossFileSearch, selectLocation]
	);
	const handleOpenFolderAsRoot = useCallback(async () => {
		clearCrossFileSearch();
		await openFolderAsRoot();
	}, [clearCrossFileSearch, openFolderAsRoot]);
	const handleOpenRecent = useCallback(
		async (item: Parameters<typeof openRecent>[0]) => {
			clearCrossFileSearch();
			await openRecent(item);
		},
		[clearCrossFileSearch, openRecent]
	);

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
		selectLocation: handleSelectLocation,
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
	const { explorerFilters } = useExplorerFilterMenuController({ loadFolder });
	const handleContextAction = useExplorerContextActions({
		locations,
		loadFolder,
		openFileAtPath,
		pinFolder,
		refreshFolder,
		selectLocation: handleSelectLocation,
		startCreateDraft,
		startRenameDraft,
	});
	const preferencesReturnOverlayRef = useRef<'home' | null>('home');
	const openPreferencesFromMenu = useCallback(() => {
		preferencesReturnOverlayRef.current = overlay === 'home' ? 'home' : null;
		setOverlay('onboarding');
	}, [overlay, setOverlay]);
	const handleCompletePreferences = useCallback(
		async (result: OnboardingResult) => {
			await completeOnboarding(result);
			if (onboardingCompleted && preferencesReturnOverlayRef.current === null) {
				setOverlay(null);
			}
		},
		[completeOnboarding, onboardingCompleted, setOverlay]
	);
	const handleCancelPreferences = useCallback(() => {
		if (!onboardingCompleted) {
			skipOnboarding();
			return;
		}
		setOverlay(preferencesReturnOverlayRef.current);
	}, [onboardingCompleted, setOverlay, skipOnboarding]);

	const { handleMenuAction, menuState } = useAppMenuActions({
		find,
		openFolderAsRoot: handleOpenFolderAsRoot,
		openRecent: handleOpenRecent,
		onOpenPreferences: openPreferencesFromMenu,
		saveOpenFile,
		startCreateDraft,
	});
	const { handleExplorerHeaderMenuAction, handleSourcesHeaderMenuAction } = useHeaderMenuActions({
		getCreateTargetFolder,
		openFolderAsRoot: handleOpenFolderAsRoot,
		refreshFolder,
		startCreateDraft,
		toggleRootPin,
	});
	const { handleIconSelect, handleSavedAction } = useSavedLocationMenuActions({
		applyLocationIcon,
		unpinLocation,
	});
	const openAppContextMenu = useAppContextMenuRouter({ cancelDraft });

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
	const unsavedFilePathKeys = useMemo(
		() => new Set(Object.values(unsavedFileDrafts).map((file) => comparablePath(file.path))),
		[unsavedFileDrafts]
	);
	const handleSaveOpenFile = useCallback(() => {
		void saveOpenFile();
	}, [saveOpenFile]);
	const handleToggleExplorer = useCallback(() => {
		setExplorerHidden((hidden) => !hidden);
	}, [setExplorerHidden]);
	const handleFindInFiles = useCallback(() => {
		setExplorerHidden(false);
		setSidebarMode('search');
	}, [setExplorerHidden, setSidebarMode]);
	const handleToggleMerged = useCallback(() => {
		setBarMerged((merged) => !merged);
	}, [setBarMerged]);
	const handleFormatAction = useCallback(
		(action: MarkdownAction) => {
			setPendingFormatAction((current) => ({
				action,
				id: (current?.id ?? 0) + 1,
			}));
		},
		[setPendingFormatAction]
	);
	const { fileActionControls, previewActionBar } = useAppFileActionSlots({
		openFile,
		dirty,
		findOpen: find.open,
		merged: barMerged,
		mode,
		saving,
		onModeChange: setMode,
		onSave: handleSaveOpenFile,
		onToggleFind: find.toggle,
		onToggleMerged: handleToggleMerged,
		onFormatAction: handleFormatAction,
	});

	useAppKeyboardShortcuts({
		draft,
		find,
		focusedEntry,
		onFindInFiles: handleFindInFiles,
		onSave: handleSaveOpenFile,
		onContextAction: (action, target) => void handleContextAction(action, target),
		onToggleFolder: (entry) => void toggleFolder(entry),
	});

	const workspaceShell = useMemo<ComponentProps<typeof AppWorkspace>['shell']>(
		() => ({
			activeRoot,
			barMerged,
			breadcrumbScope,
			explorerHidden,
			fileActionsSlot: fileActionControls,
			menuState,
			overlay,
			title,
			onMenuAction: handleMenuAction,
			onGoHome: () => setOverlay('home'),
			onToggleExplorer: handleToggleExplorer,
		}),
		[
			activeRoot,
			barMerged,
			breadcrumbScope,
			explorerHidden,
			fileActionControls,
			handleMenuAction,
			handleToggleExplorer,
			menuState,
			setOverlay,
			overlay,
			title,
		]
	);

	const workspaceSidebar = useMemo<ComponentProps<typeof AppWorkspace>['sidebar']>(
		() => ({
			activeFilePath: openFilePath ?? undefined,
			activeRoot,
			beginInternalDrag,
			childrenCache,
			contextPath: contextMenu?.path,
			draft,
			expanded,
			focusedPath: focusedEntry?.path ?? undefined,
			homePath,
			loadingPaths,
			locations,
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
				onOpenResult: openSearchResult,
			},
			selectedFolderPath: selectedFolderPath ?? undefined,
			sidebarWidth,
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
			onOpenFolder: handleOpenFolderAsRoot,
			onRefreshRoot: () => {
				if (activeRoot) {
					void refreshFolder(activeRoot.path);
				}
			},
			onRootContextMenu: (event) => openAppContextMenu({ kind: 'root' }, event),
			onSavedContextMenu: (location, event) =>
				openAppContextMenu({ kind: 'saved', location }, event),
			onOpenRecent: handleOpenRecent,
			onOpenRecentFile: (file) => void openFileAtPath(file.path),
			onRecentContextMenu: (item, event) => openAppContextMenu({ kind: 'recent', item }, event),
			onSelectFile: selectFile,
			onSelectHeading: scrollToAnchor,
			onSelectLocation: handleSelectLocation,
			onSourcesHeaderContextMenu: (event) => openAppContextMenu({ kind: 'sources-header' }, event),
			onToggleFolder: toggleFolder,
			onToggleRootPin: toggleRootPin,
		}),
		[
			activeRoot,
			beginInternalDrag,
			cancelDraft,
			childrenCache,
			clearCrossFileSearch,
			contextMenu?.path,
			draft,
			expanded,
			focusedEntry?.path,
			getCreateTargetFolder,
			homePath,
			isPinnable,
			isUnpinnable,
			loadingPaths,
			locations,
			openAppContextMenu,
			openFilePath,
			openFileAtPath,
			handleOpenFolderAsRoot,
			handleOpenRecent,
			openSearchResult,
			refreshFolder,
			rootChildren,
			rootDropActive,
			runCrossFileSearch,
			scrollToAnchor,
			searchError,
			searchLoading,
			searchQuery,
			searchResults,
			searchTruncated,
			searchedQuery,
			selectFile,
			handleSelectLocation,
			selectedFolderPath,
			setSearchQuery,
			setSidebarMode,
			sidebarWidth,
			startCreateDraft,
			submitDraft,
			toggleFolder,
			toggleRootPin,
			treeDropTargetPath,
			unsavedFilePathKeys,
		]
	);

	const workspaceHome = useMemo<ComponentProps<typeof AppWorkspace>['home']>(
		() => ({
			dropActive: dropState.target?.kind === 'home',
			homePath,
			locationIcons,
			locations,
			recents,
			userName,
			openHomeOnStartup,
			onOpenHomeOnStartupChange: setOpenHomeOnStartup,
			onEditSetup: () => {
				preferencesReturnOverlayRef.current = 'home';
				setOverlay('onboarding');
			},
			onLocationContextMenu: (location, event) =>
				openAppContextMenu({ kind: 'saved', location }, event),
			onOpenFolder: handleOpenFolderAsRoot,
			onOpenRecent: handleOpenRecent,
			onRecentContextMenu: (item, event) => openAppContextMenu({ kind: 'recent', item }, event),
			onSelectLocation: handleSelectLocation,
		}),
		[
			dropState.target?.kind,
			handleOpenFolderAsRoot,
			handleOpenRecent,
			handleSelectLocation,
			homePath,
			locationIcons,
			locations,
			openAppContextMenu,
			openHomeOnStartup,
			recents,
			setOverlay,
			setOpenHomeOnStartup,
			userName,
		]
	);

	const workspacePreview = useMemo<ComponentProps<typeof AppWorkspace>['preview']>(
		() => ({
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
			onSelectHeading: scrollToAnchor,
		}),
		[
			dropCount,
			dropState,
			error,
			find,
			handleLinkClick,
			mode,
			openFile,
			outlinePanelVisible,
			pendingFormatAction,
			previewActionBar,
			renderedMarkdown,
			scrollToAnchor,
			updateOpenFileContent,
		]
	);

	const workspaceResize = useMemo<ComponentProps<typeof AppWorkspace>['resize']>(
		() => ({ onPointerDown: startSidebarResize }),
		[startSidebarResize]
	);

	const menusContext = useMemo<ComponentProps<typeof AppMenus>['context']>(
		() => ({
			canPin:
				contextMenuVariant === 'explorer' &&
				contextMenu?.kind === 'folder' &&
				isPinnable(contextMenu.path),
			canOpenAsRoot:
				contextMenuVariant === 'explorer' &&
				contextMenu?.kind === 'folder' &&
				!!activeRoot &&
				comparablePath(contextMenu.path) !== comparablePath(activeRoot.path),
			onAction: (action, target) => void handleContextAction(action, target),
		}),
		[activeRoot, contextMenu, contextMenuVariant, handleContextAction, isPinnable]
	);

	const menusExplorerHeader = useMemo<ComponentProps<typeof AppMenus>['explorerHeader']>(
		() => ({
			filters: explorerFilters,
			visibleActions: explorerHeaderActionsVisible,
			onAction: (action) => void handleExplorerHeaderMenuAction(action),
		}),
		[explorerFilters, explorerHeaderActionsVisible, handleExplorerHeaderMenuAction]
	);

	const menusSourcesHeader = useMemo<ComponentProps<typeof AppMenus>['sourcesHeader']>(
		() => ({
			visibleActions: sourcesHeaderActionsVisible,
			showOutlineAction: !outlinePanelVisible,
			rootPinned: activeRoot ? !isPinnable(activeRoot.path) : false,
			rootPinDisabled: !activeRoot || !isUnpinnable(activeRoot),
			onAction: handleSourcesHeaderMenuAction,
		}),
		[
			activeRoot,
			handleSourcesHeaderMenuAction,
			isPinnable,
			isUnpinnable,
			outlinePanelVisible,
			sourcesHeaderActionsVisible,
		]
	);

	const menusSaved = useMemo<ComponentProps<typeof AppMenus>['saved']>(
		() => ({
			canUnpin: isUnpinnable,
			onAction: (action, location) => void handleSavedAction(action, location),
		}),
		[handleSavedAction, isUnpinnable]
	);

	const menusIconPicker = useMemo<ComponentProps<typeof AppMenus>['iconPicker']>(
		() => ({
			onSelect: handleIconSelect,
		}),
		[handleIconSelect]
	);

	return (
		<div
			className={`app-window ${explorerHidden ? 'explorer-hidden' : ''} ${isMaximized ? 'fullscreen' : ''} ${theme === 'light' ? 'theme-light' : ''} ${overlay ? 'overlay-active' : ''}`}
		>
			<AppWorkspace
				shell={workspaceShell}
				sidebar={workspaceSidebar}
				home={workspaceHome}
				preview={workspacePreview}
				resize={workspaceResize}
			/>

			<AppOnboardingOverlay
				visible={overlay === 'onboarding'}
				defaultHomeName={defaultLocs[0]?.name}
				homePath={homePath}
				locations={locations}
				userName={userName}
				viewMode={mode}
				onboardingCompleted={onboardingCompleted}
				shellIntegration={shellIntegration}
				onPickFolder={pickFolder}
				onComplete={handleCompletePreferences}
				onSkip={handleCancelPreferences}
			/>

			<DragLayer state={internalDragState} />
			<TreeDropBadge
				target={dropState.target}
				hint={dropState.renderHint}
				mode={dropState.mode}
				count={dropCount}
			/>

			<AppMenus
				context={menusContext}
				explorerHeader={menusExplorerHeader}
				sourcesHeader={menusSourcesHeader}
				saved={menusSaved}
				iconPicker={menusIconPicker}
			/>
		</div>
	);
}

export default App;
