import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { getCurrentWindow, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/window";
import { createFile, createFolder, defaultLocations, deletePath, pickFolder, readFile, readFolder, renamePath, resolveLinkPath, revealInExplorer, writeFile } from "./features/files/api/filesApi";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { Sidebar } from "./features/explorer/components/Sidebar";
import { ContextMenu, type ContextMenuAction, type ContextMenuTarget } from "./features/explorer/components/ContextMenu";
import { SavedContextMenu, type SavedMenuAction } from "./features/explorer/components/SavedContextMenu";
import { IconPickerMenu } from "./features/explorer/components/IconPickerMenu";
import type { InlineDraft } from "./features/explorer/components/TreeInlineInput";
import { SidebarResizeHandle } from "./features/explorer/components/SidebarResizeHandle";
import { FileActionBar } from "./features/file-actions/components/FileActionBar";
import { FileActionControls, type FileViewMode } from "./features/file-actions/components/FileActionControls";
import { FindBar } from "./features/file-actions/components/FindBar";
import { MarkdownFormatToolbar } from "./features/file-actions/components/MarkdownFormatToolbar";
import { useFindInPreview } from "./features/file-actions/hooks/useFindInPreview";
import type { MarkdownAction } from "./features/preview/markdownActions";
import { markdown } from "./features/preview/markdown";
import { slugify } from "./features/preview/slug";
import { PreviewPanel } from "./features/preview/components/PreviewPanel";
import { TitleBar } from "./features/window-chrome/components/TitleBar";
import type { Entry, OpenFile } from "./shared/types/files";
import { fileExtension, fileKindFromPath, fileName, isVisibleFileName, joinPath, parentName, parentPath, relativePath } from "./shared/utils/path";
import { loadAppConfiguration, loadAppSession, saveAppConfiguration, saveAppSession, type AppConfigurationState, type AppTheme, type StoredWindowFrame } from "./shared/state/persistence";
import "./App.css";

const DEFAULT_SIDEBAR_WIDTH = 280;
const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 420;
const MIN_CONTENT_WIDTH = 420;

function clampSidebarWidth(width: number) {
  const availableMax = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, window.innerWidth - MIN_CONTENT_WIDTH));

  return Math.min(availableMax, Math.max(MIN_SIDEBAR_WIDTH, width));
}

function comparablePath(path: string) {
  return path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function containsPath(rootPath: string, path: string) {
  const root = comparablePath(rootPath);
  const child = comparablePath(path);

  return child === root || child.startsWith(`${root}/`);
}

function findContainingLocation(locations: Entry[], path?: string) {
  if (!path) {
    return null;
  }

  return locations.filter((location) => containsPath(location.path, path)).sort((left, right) => comparablePath(right.path).length - comparablePath(left.path).length)[0] ?? null;
}

function App() {
  const initialConfiguration = useMemo(() => loadAppConfiguration(), []);
  const initialSession = useMemo(() => loadAppSession(), []);
  const [defaultLocs, setDefaultLocs] = useState<Entry[]>([]);
  const [pinnedLocations, setPinnedLocations] = useState<Entry[]>(() => initialConfiguration.pinnedLocations ?? []);
  const [removedDefaultPaths, setRemovedDefaultPaths] = useState<string[]>(() => initialConfiguration.removedDefaultPaths ?? []);
  const [activeRoot, setActiveRoot] = useState<Entry | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(initialSession.expandedPaths));
  const [childrenCache, setChildrenCache] = useState<Record<string, Entry[]>>({});
  const [openFile, setOpenFile] = useState<OpenFile | null>(null);
  const [openFilePath, setOpenFilePath] = useState<string | null>(() => initialSession.openFilePath ?? null);
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [explorerHidden, setExplorerHidden] = useState(() => initialConfiguration.explorerHidden ?? false);
  const [sidebarWidth, setSidebarWidth] = useState(() => clampSidebarWidth(initialConfiguration.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH));
  const [mode, setMode] = useState<FileViewMode>(() => initialConfiguration.viewMode ?? "preview");
  const [pendingFormatAction, setPendingFormatAction] = useState<{
    action: MarkdownAction;
    id: number;
  } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [barMerged, setBarMerged] = useState(() => initialConfiguration.barMerged ?? false);
  const [theme, setTheme] = useState<AppTheme>(() => initialConfiguration.theme ?? "dark");
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(
    () => initialSession.selectedFolderPath ?? (initialSession.openFilePath ? parentPath(initialSession.openFilePath) : null),
  );
  const [windowFrame, setWindowFrame] = useState<StoredWindowFrame | undefined>(() => initialConfiguration.windowFrame);
  const [contextMenu, setContextMenu] = useState<ContextMenuTarget | null>(null);
  const [savedMenu, setSavedMenu] = useState<{
    location: Entry;
    x: number;
    y: number;
  } | null>(null);
  const [iconPicker, setIconPicker] = useState<{
    location: Entry;
    x: number;
    y: number;
  } | null>(null);
  const [locationIcons, setLocationIcons] = useState<Record<string, string>>(
    () => initialConfiguration.locationIcons ?? {},
  );
  const [focusedEntry, setFocusedEntry] = useState<Entry | null>(null);
  const [draft, setDraft] = useState<InlineDraft | null>(null);
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const findTargetRef = useRef<HTMLElement | null>(null);
  // A heading fragment to scroll to once the just-opened file has rendered
  // (set when following a cross-file link like `doc.md#section`).
  const pendingAnchorRef = useRef<string | null>(null);
  const configurationRef = useRef<AppConfigurationState>({
    explorerHidden,
    sidebarWidth,
    barMerged,
    viewMode: mode,
    theme,
    windowFrame,
    pinnedLocations,
    removedDefaultPaths,
    locationIcons,
  });

  // Home is the first default location and can never be unpinned.
  const homePath = defaultLocs[0]?.path;

  // The Saved list = defaults (minus user-removed) followed by custom pins,
  // de-duplicated by path. Home always stays first.
  const locations = useMemo<Entry[]>(() => {
    const removed = new Set(removedDefaultPaths.map((path) => comparablePath(path)));
    const seen = new Set<string>();
    const result: Entry[] = [];

    for (const location of defaultLocs) {
      const key = comparablePath(location.path);
      const isHome = homePath ? comparablePath(homePath) === key : false;
      if (!isHome && removed.has(key)) {
        continue;
      }
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push(location);
    }

    for (const location of pinnedLocations) {
      const key = comparablePath(location.path);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push(location);
    }

    return result;
  }, [defaultLocs, pinnedLocations, removedDefaultPaths, homePath]);

  function isPinnable(path: string) {
    const key = comparablePath(path);
    return !locations.some((location) => comparablePath(location.path) === key);
  }

  function isUnpinnable(location: Entry) {
    if (homePath && comparablePath(homePath) === comparablePath(location.path)) {
      return false;
    }
    return true;
  }

  const renderedMarkdown = useMemo(() => {
    if (!openFile || openFile.kind !== "md") {
      return "";
    }

    return markdown.render(openFile.content);
  }, [openFile]);

  const find = useFindInPreview(findTargetRef, `${openFile?.path ?? ""}:${mode}:${openFile?.kind === "md" ? renderedMarkdown : (openFile?.content ?? "")}`);

  // After following a cross-file link with a #fragment, scroll to the heading
  // once the new document has rendered into the preview. The preview container
  // (findTargetRef) only exists when its pane is visible, so this no-ops in the
  // editor-only view; the pending anchor is cleared either way.
  useEffect(() => {
    const fragment = pendingAnchorRef.current;
    if (!fragment) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      scrollToAnchor(fragment);
      pendingAnchorRef.current = null;
    });

    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openFile?.path, renderedMarkdown, mode]);

  useEffect(() => {
    const nextConfiguration: AppConfigurationState = {
      explorerHidden,
      sidebarWidth,
      barMerged,
      viewMode: mode,
      theme,
      windowFrame,
      pinnedLocations,
      removedDefaultPaths,
      locationIcons,
    };

    configurationRef.current = nextConfiguration;
    saveAppConfiguration(nextConfiguration);
  }, [barMerged, explorerHidden, mode, theme, sidebarWidth, windowFrame, pinnedLocations, removedDefaultPaths, locationIcons]);

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

  useEffect(() => {
    const appWindow = getCurrentWindow();
    const unlisteners: Array<() => void> = [];
    let cancelled = false;

    async function captureWindowFrame() {
      try {
        const [size, position, maximized] = await Promise.all([appWindow.innerSize(), appWindow.outerPosition(), appWindow.isMaximized()]);

        const nextFrame: StoredWindowFrame = {
          width: size.width,
          height: size.height,
          x: position.x,
          y: position.y,
          maximized,
        };

        if (cancelled) {
          return;
        }

        setWindowFrame(nextFrame);

        const nextConfiguration = {
          ...configurationRef.current,
          windowFrame: nextFrame,
        };
        configurationRef.current = nextConfiguration;
        saveAppConfiguration(nextConfiguration);
      } catch {
        // Window persistence is best effort outside the Tauri runtime.
      }
    }

    async function restoreWindowFrame() {
      const frame = initialConfiguration.windowFrame;
      if (!frame) {
        return;
      }

      try {
        if (frame.maximized) {
          await appWindow.setPosition(new PhysicalPosition(frame.x, frame.y));
          await appWindow.setSize(new PhysicalSize(frame.width, frame.height));
          await appWindow.maximize();
          return;
        }

        await appWindow.setPosition(new PhysicalPosition(frame.x, frame.y));
        await appWindow.setSize(new PhysicalSize(frame.width, frame.height));
      } catch {
        // Ignore stale monitor positions or unavailable window APIs.
      }
    }

    void restoreWindowFrame();

    void appWindow
      .onResized(() => void captureWindowFrame())
      .then((unlisten) => {
        if (cancelled) {
          unlisten();
        } else {
          unlisteners.push(unlisten);
        }
      })
      .catch(() => undefined);

    void appWindow
      .onMoved(() => void captureWindowFrame())
      .then((unlisten) => {
        if (cancelled) {
          unlisten();
        } else {
          unlisteners.push(unlisten);
        }
      })
      .catch(() => undefined);

    void appWindow
      .onCloseRequested(async () => {
        await captureWindowFrame();
      })
      .then((unlisten) => {
        if (cancelled) {
          unlisten();
        } else {
          unlisteners.push(unlisten);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [initialConfiguration.windowFrame]);

  const saveOpenFile = useCallback(async () => {
    if (!openFile || saving) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await writeFile(openFile.path, openFile.content);
      setDirty(false);
    } catch (cause) {
      setError(`Unable to save file: ${String(cause)}`);
    } finally {
      setSaving(false);
    }
  }, [openFile, saving]);

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
            ? { name: fileName(initialSession.activeRootPath), path: initialSession.activeRootPath, is_dir: true, kind: "folder" as const }
            : null);
        const first = restoredRoot ?? defaults[0] ?? null;
        const restoredSelectedFolder = initialSession.selectedFolderPath ?? (initialSession.openFilePath ? parentPath(initialSession.openFilePath) : (first?.path ?? null));

        setActiveRoot(first);
        setSelectedFolderPath(restoredSelectedFolder);

        if (first) {
          await loadFolder(first.path);
          await Promise.all(initialSession.expandedPaths.filter((path) => path !== first.path).map((path) => loadFolder(path, { quiet: true })));
        }

        if (initialSession.openFilePath) {
          await openFileAtPath(initialSession.openFilePath);
        }
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

  async function openFileAtPath(path: string, options?: { mode?: FileViewMode }) {
    setError(null);
    setOpenFilePath(path);
    setSelectedFolderPath(parentPath(path));

    try {
      const content = await readFile(path);
      setOpenFile({
        path,
        name: fileName(path),
        content,
        kind: fileKindFromPath(path),
      });
      setDirty(false);
      if (options?.mode) {
        setMode(options.mode);
      }
      find.close();
    } catch (cause) {
      setError(`Unable to read file: ${String(cause)}`);
    }
  }

  // Scroll the preview to a heading matching a URL fragment. Tries the raw
  // fragment first (explicit ids/names), then the slugified form so a link like
  // `#My Heading` matches the generated `my-heading` heading id. Returns whether
  // a target was found.
  function scrollToAnchor(fragment: string) {
    const scope = findTargetRef.current;
    if (!scope || !fragment) {
      return false;
    }

    for (const candidate of [fragment, slugify(fragment)]) {
      if (!candidate) {
        continue;
      }
      const node = scope.querySelector(`#${CSS.escape(candidate)}, [name="${CSS.escape(candidate)}"]`);
      if (node) {
        node.scrollIntoView({ behavior: "smooth", block: "start" });
        return true;
      }
    }

    return false;
  }

  // Route a clicked link in the rendered preview by its target:
  //  - anchors (#heading) scroll within the current document
  //  - external links (http(s), mailto, etc.) open in the OS default handler
  //  - everything else is treated as a file path resolved against the open
  //    file's directory; supported files open in-app (jumping to the heading if
  //    the link carries a #fragment), the rest fall back to the OS so e.g.
  //    images or PDFs still open.
  async function handleLinkClick(href: string) {
    const target = href.trim();
    if (!target) {
      return;
    }

    // In-document anchor.
    if (target.startsWith("#")) {
      scrollToAnchor(decodeURIComponent(target.slice(1)));
      return;
    }

    // External / non-file schemes (http, https, mailto, tel, …) — hand off to
    // the OS. A leading "scheme:" that isn't a Windows drive letter (C:\) marks
    // these.
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) && !/^[a-z]:[\\/]/i.test(target)) {
      try {
        await openUrl(target);
      } catch (cause) {
        setError(`Unable to open link: ${String(cause)}`);
      }
      return;
    }

    if (!openFilePath) {
      return;
    }

    // File link, optionally with a heading fragment (`doc.md#section`). Split off
    // the fragment, resolve the path against the open file's directory, open it,
    // then scroll to the heading once the new content has rendered.
    const hashIndex = target.indexOf("#");
    const pathPart = hashIndex >= 0 ? target.slice(0, hashIndex) : target;
    const fragment = hashIndex >= 0 ? decodeURIComponent(target.slice(hashIndex + 1)) : "";
    const [cleanPath] = pathPart.split("?");

    try {
      const resolved = await resolveLinkPath(openFilePath, decodeURIComponent(cleanPath));

      if (isVisibleFileName(resolved)) {
        // Same file already open: just scroll. Otherwise open it and defer the
        // scroll until the preview has re-rendered with the new headings.
        if (fragment && comparablePath(resolved) === comparablePath(openFilePath)) {
          scrollToAnchor(fragment);
        } else {
          pendingAnchorRef.current = fragment || null;
          await openFileAtPath(resolved);
        }
      } else {
        // Not a viewer-supported file (image, pdf, folder, …) — let the OS open it.
        await openPath(resolved);
      }
    } catch (cause) {
      setError(`Unable to open link: ${String(cause)}`);
    }
  }

  async function selectLocation(location: Entry) {
    setActiveRoot(location);
    setSelectedFolderPath(location.path);
    setOpenFile(null);
    setOpenFilePath(null);
    setExpanded(new Set());
    setError(null);
    setDirty(false);
    setMode("preview");
    find.close();
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
    await openFileAtPath(entry.path);
  }

  function entryToTarget(entry: Entry, x = 0, y = 0): ContextMenuTarget {
    return {
      kind: entry.is_dir ? "folder" : "file",
      path: entry.path,
      name: entry.name,
      x,
      y,
    };
  }

  function openEntryContextMenu(entry: Entry, event: ReactMouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setDraft(null);
    setFocusedEntry(entry);
    setContextMenu(entryToTarget(entry, event.clientX, event.clientY));
  }

  function openRootContextMenu(event: ReactMouseEvent) {
    if (!activeRoot) {
      return;
    }
    event.preventDefault();
    setDraft(null);
    setContextMenu({
      kind: "folder",
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
    setSavedMenu({ location, x: event.clientX, y: event.clientY });
  }

  // Add a folder to the Saved list. Re-pinning a previously removed default
  // simply clears it from the removed set rather than duplicating it.
  function pinFolder(entry: Entry) {
    const key = comparablePath(entry.path);
    const isDefault = defaultLocs.some((location) => comparablePath(location.path) === key);

    if (isDefault) {
      setRemovedDefaultPaths((current) => current.filter((path) => comparablePath(path) !== key));
      return;
    }

    setPinnedLocations((current) => (current.some((location) => comparablePath(location.path) === key) ? current : [...current, { ...entry, is_dir: true, kind: "folder" }]));
  }

  // Open a folder via the native picker and make it the explorer root, without
  // adding it to Saved. The user can pin it afterwards (right-click the explorer).
  async function openFolderAsRoot() {
    try {
      const folder = await pickFolder();
      if (!folder) {
        return;
      }
      await selectLocation(folder);
    } catch (cause) {
      setError(`Unable to open folder: ${String(cause)}`);
    }
  }

  // Remove a Saved location. Home cannot be unpinned. Removing a default is
  // recorded so it stays hidden; removing a custom pin drops it.
  function unpinLocation(location: Entry) {
    if (!isUnpinnable(location)) {
      return;
    }

    const key = comparablePath(location.path);
    const isDefault = defaultLocs.some((entry) => comparablePath(entry.path) === key);

    if (isDefault) {
      setRemovedDefaultPaths((current) => (current.some((path) => comparablePath(path) === key) ? current : [...current, location.path]));
    } else {
      setPinnedLocations((current) => current.filter((entry) => comparablePath(entry.path) !== key));
    }
  }

  // Pin or unpin the current explorer root, with a confirmation prompt. Disabled
  // for Home (and when there is no root).
  function toggleRootPin() {
    if (!activeRoot || !isUnpinnable(activeRoot)) {
      return;
    }

    const pinned = !isPinnable(activeRoot.path);

    if (pinned) {
      const confirmed = window.confirm(`Remove "${activeRoot.name}" from your pinned folders?`);
      if (!confirmed) {
        return;
      }
      unpinLocation(activeRoot);
    } else {
      const confirmed = window.confirm(`Pin "${activeRoot.name}" to your saved folders?`);
      if (!confirmed) {
        return;
      }
      pinFolder(activeRoot);
    }
  }

  async function handleSavedAction(action: SavedMenuAction, location: Entry) {
    if (action === "change-icon") {
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
        case "reveal":
          await revealInExplorer(location.path);
          break;
        case "copy-path":
          await navigator.clipboard?.writeText(location.path);
          break;
        case "copy-relative-path":
          await navigator.clipboard?.writeText(activeRoot ? relativePath(activeRoot.path, location.path) : location.path);
          break;
        case "unpin":
          unpinLocation(location);
          break;
        default:
          break;
      }
    } catch (cause) {
      setError(`${String(cause)}`);
    }
  }

  function applyLocationIcon(location: Entry, iconName: string) {
    setLocationIcons((current) => ({ ...current, [location.path]: iconName }));
  }

  // Ensure a folder is expanded and its children are loaded so a new draft row
  // is visible inside it.
  async function ensureFolderOpen(path: string) {
    if (!expanded.has(path)) {
      setExpanded((current) => new Set(current).add(path));
    }
    await loadFolder(path);
  }

  async function startCreateDraft(parentPath: string, kind: "file" | "folder") {
    const isRoot = activeRoot?.path === parentPath;
    if (!isRoot) {
      await ensureFolderOpen(parentPath);
    }

    setDraft({
      parentPath,
      mode: "create",
      kind,
      initialValue: kind === "file" ? ".md" : "",
      // For new files the suggested ".md" stays visible with the caret at the
      // start so the user types the name before the extension.
      selection: "start",
    });
  }

  function startRenameDraft(entry: Entry) {
    setDraft({
      parentPath: parentPath(entry.path),
      mode: "rename",
      kind: entry.is_dir ? "folder" : "file",
      initialValue: entry.name,
      selection: entry.is_dir ? "all" : "name",
      targetPath: entry.path,
    });
  }

  function cancelDraft() {
    setDraft(null);
  }

  // Returns true if the caller should proceed (user confirmed or no warning
  // needed). Folders and any already-visible name skip the prompt.
  function confirmExtensionIfNeeded(name: string, kind: "file" | "folder") {
    if (kind === "folder" || isVisibleFileName(name)) {
      return true;
    }

    const ext = fileExtension(name);
    const detail = ext ? `".${ext}" files` : "files without a .md, .markdown, or .txt extension";
    return window.confirm(`"${name}" will not be visible in Markdown Viewer because ${detail} aren't shown here.\n\nCreate it anyway?`);
  }

  async function submitDraft(rawValue: string) {
    const current = draft;
    if (!current) {
      return;
    }

    const name = rawValue.trim();
    setDraft(null);

    // Empty or unchanged-on-rename: treat as cancel.
    if (!name) {
      return;
    }
    if (/[\\/]/.test(name)) {
      setError("Names cannot contain slashes.");
      return;
    }

    try {
      if (current.mode === "create") {
        if (!confirmExtensionIfNeeded(name, current.kind)) {
          return;
        }

        const targetPath = joinPath(current.parentPath, name);
        if (current.kind === "folder") {
          await createFolder(targetPath);
        } else {
          await createFile(targetPath);
        }

        await refreshFolder(current.parentPath);

        // Open the new file in the editor so the user can start typing.
        if (current.kind === "file" && isVisibleFileName(name)) {
          await openFileAtPath(targetPath, { mode: "edit" });
        }
        return;
      }

      // Rename
      const originalPath = current.targetPath;
      if (!originalPath || name === fileName(originalPath)) {
        return;
      }
      if (current.kind === "file" && !confirmExtensionIfNeeded(name, "file")) {
        return;
      }

      const targetPath = joinPath(current.parentPath, name);
      await renamePath(originalPath, targetPath);
      await refreshFolder(current.parentPath);

      // Keep keyboard focus on the renamed entry at its new path.
      setFocusedEntry((focused) => (focused?.path === originalPath ? { ...focused, name, path: targetPath } : focused));

      // If the renamed file is the open one, follow it (or close it when it is
      // no longer a visible kind).
      if (openFilePath === originalPath) {
        if (current.kind === "file" && isVisibleFileName(name)) {
          await openFileAtPath(targetPath);
        } else {
          setOpenFile(null);
          setOpenFilePath(null);
        }
      }
    } catch (cause) {
      setError(`${String(cause)}`);
    }
  }

  async function handleContextAction(action: ContextMenuAction, target: ContextMenuTarget) {
    setContextMenu(null);

    try {
      switch (action) {
        case "new-file":
          await startCreateDraft(target.path, "file");
          break;
        case "new-folder":
          await startCreateDraft(target.path, "folder");
          break;
        case "pin":
          pinFolder({
            name: target.name,
            path: target.path,
            is_dir: true,
            kind: "folder",
          });
          break;
        case "rename":
          startRenameDraft({
            name: target.name,
            path: target.path,
            is_dir: target.kind === "folder",
            kind: target.kind === "folder" ? "folder" : fileKindFromPath(target.path),
          });
          break;
        case "open":
          if (target.kind === "file") {
            await openFileAtPath(target.path);
          }
          break;
        case "reveal":
          await revealInExplorer(target.path);
          break;
        case "copy-path":
          await navigator.clipboard?.writeText(target.path);
          break;
        case "copy-relative-path":
          await navigator.clipboard?.writeText(activeRoot ? relativePath(activeRoot.path, target.path) : target.path);
          break;
        case "delete": {
          const confirmed = window.confirm(`Move "${target.name}" to the Recycle Bin?`);
          if (!confirmed) {
            break;
          }
          await deletePath(target.path);
          if (openFilePath === target.path) {
            setOpenFile(null);
            setOpenFilePath(null);
          }
          setFocusedEntry((current) => (current?.path === target.path ? null : current));
          await refreshFolder(parentPath(target.path));
          break;
        }
        default:
          break;
      }
    } catch (cause) {
      setError(`${String(cause)}`);
    }
  }

  function updateOpenFileContent(content: string) {
    setOpenFile((current) => (current ? { ...current, content } : current));
    setDirty(true);
  }

  function startSidebarResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = sidebarWidth;

    function resize(moveEvent: PointerEvent) {
      setSidebarWidth(clampSidebarWidth(startWidth + moveEvent.clientX - startX));
    }

    function stopResize() {
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", stopResize);
    }

    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", stopResize);
  }

  const title = openFile?.name ?? activeRoot?.name ?? "Markdown Viewer";
  // Show the open file's parent folder as a middle crumb, but only when it
  // isn't the root itself (otherwise the root name would appear twice).
  const breadcrumbScope = openFile && activeRoot && comparablePath(parentPath(openFile.path)) !== comparablePath(activeRoot.path) ? parentName(openFile.path) : null;
  const rootChildren = activeRoot ? childrenCache[activeRoot.path] : undefined;
  const fileActionControls = openFile ? (
    <FileActionControls
      dirty={dirty}
      findOpen={find.open}
      merged={barMerged}
      mode={mode}
      saving={saving}
      onModeChange={(nextMode) => {
        setMode(nextMode);
        if (nextMode === "code") {
          find.close();
        }
      }}
      onSave={() => void saveOpenFile()}
      onToggleFind={() => {
        if (!find.open) {
          setMode("preview");
        }

        find.toggle();
      }}
      onToggleMerged={() => setBarMerged((merged) => !merged)}
    />
  ) : null;
  const formatControls =
    openFile?.kind === "md" && (mode === "edit" || mode === "code") ? (
      <MarkdownFormatToolbar
        onAction={(action) =>
          setPendingFormatAction((current) => ({
            action,
            id: (current?.id ?? 0) + 1,
          }))
        }
      />
    ) : null;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveOpenFile();
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        if (!find.open) {
          setMode("preview");
        }
        find.setOpen(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [find, saveOpenFile]);

  // Explorer keyboard shortcuts: act on the focused tree item, mirroring the
  // context menu. Only fire when focus is inside the explorer and not typing in
  // the inline rename/create input.
  useEffect(() => {
    function handleExplorerKeyDown(event: KeyboardEvent) {
      if (!focusedEntry || draft) {
        return;
      }

      const active = document.activeElement as HTMLElement | null;
      const insideExplorer = Boolean(active?.closest(".sidebar"));
      if (!insideExplorer) {
        return;
      }
      if (active?.classList.contains("tree-inline-input")) {
        return;
      }

      const target = entryToTarget(focusedEntry);

      // Rename — F2
      if (event.key === "F2") {
        event.preventDefault();
        void handleContextAction("rename", target);
        return;
      }

      // Delete — Del (keeps the confirm dialog)
      if (event.key === "Delete") {
        event.preventDefault();
        void handleContextAction("delete", target);
        return;
      }

      // Open / toggle — Enter
      if (event.key === "Enter") {
        event.preventDefault();
        if (focusedEntry.is_dir) {
          void toggleFolder(focusedEntry);
        } else {
          void handleContextAction("open", target);
        }
        return;
      }

      // Reveal in File Explorer — Shift+Alt+R
      if (event.shiftKey && event.altKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        void handleContextAction("reveal", target);
        return;
      }

      // Copy Path — Shift+Alt+C
      if (event.shiftKey && event.altKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        void handleContextAction("copy-path", target);
      }
    }

    window.addEventListener("keydown", handleExplorerKeyDown);

    return () => {
      window.removeEventListener("keydown", handleExplorerKeyDown);
    };
  });

  return (
    <div className={`app-window ${explorerHidden ? "explorer-hidden" : ""} ${isMaximized ? "fullscreen" : ""} ${theme === "light" ? "theme-light" : ""}`}>
      <TitleBar
        fileActionsSlot={barMerged ? fileActionControls : null}
        explorerHidden={explorerHidden}
        rootName={activeRoot?.name}
        scopeName={breadcrumbScope}
        title={title}
        onToggleExplorer={() => setExplorerHidden((hidden) => !hidden)}
      />

      <div className="workspace">
        <Sidebar
          width={explorerHidden ? 0 : sidebarWidth}
          locations={locations}
          activeRoot={activeRoot}
          rootChildren={rootChildren}
          expanded={expanded}
          childrenCache={childrenCache}
          loadingPaths={loadingPaths}
          selectedFolderPath={selectedFolderPath ?? undefined}
          activeFilePath={openFilePath ?? undefined}
          contextPath={contextMenu?.path}
          focusedPath={focusedEntry?.path ?? undefined}
          draft={draft}
          onSelectLocation={selectLocation}
          onToggleFolder={toggleFolder}
          onSelectFile={selectFile}
          onEntryContextMenu={openEntryContextMenu}
          onRootContextMenu={openRootContextMenu}
          onSavedContextMenu={openSavedContextMenu}
          onOpenFolder={() => void openFolderAsRoot()}
          rootPinned={activeRoot ? !isPinnable(activeRoot.path) : false}
          rootPinDisabled={!activeRoot || !isUnpinnable(activeRoot)}
          onToggleRootPin={toggleRootPin}
          onDraftSubmit={submitDraft}
          onDraftCancel={cancelDraft}
          locationIcons={locationIcons}
          homePath={homePath}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        />

        <SidebarResizeHandle onPointerDown={startSidebarResize} />

        <PreviewPanel
          actionBar={
            openFile && (formatControls || !barMerged) ? (
              <FileActionBar>
                {formatControls}
                <span className="file-action-spacer" aria-hidden="true" />
                {!barMerged ? fileActionControls : null}
              </FileActionBar>
            ) : null
          }
          error={error}
          findBar={
            openFile ? (
              <FindBar
                current={find.current}
                open={find.open}
                query={find.query}
                total={find.total}
                onClose={find.close}
                onNext={find.goToNext}
                onPrevious={find.goToPrevious}
                onQueryChange={find.setQuery}
              />
            ) : null
          }
          findTargetRef={findTargetRef}
          mode={mode}
          openFile={openFile}
          onContentChange={updateOpenFileContent}
          onLinkClick={(href) => void handleLinkClick(href)}
          pendingFormatAction={pendingFormatAction}
          renderedMarkdown={renderedMarkdown}
        />
      </div>

      {contextMenu ? (
        <ContextMenu
          target={contextMenu}
          canPin={contextMenu.kind === "folder" && isPinnable(contextMenu.path)}
          onAction={(action, target) => void handleContextAction(action, target)}
          onClose={() => setContextMenu(null)}
        />
      ) : null}

      {savedMenu ? (
        <SavedContextMenu
          location={savedMenu.location}
          x={savedMenu.x}
          y={savedMenu.y}
          canUnpin={isUnpinnable(savedMenu.location)}
          onAction={(action, location) => void handleSavedAction(action, location)}
          onClose={() => setSavedMenu(null)}
        />
      ) : null}

      {iconPicker ? (
        <IconPickerMenu
          x={iconPicker.x}
          y={iconPicker.y}
          currentIcon={locationIcons[iconPicker.location.path]}
          onSelect={(iconName) => applyLocationIcon(iconPicker.location, iconName)}
          onClose={() => setIconPicker(null)}
        />
      ) : null}
    </div>
  );
}

export default App;
