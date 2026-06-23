import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  getCurrentWindow,
  PhysicalPosition,
  PhysicalSize,
} from "@tauri-apps/api/window";
import {
  defaultLocations,
  readFile,
  readFolder,
  writeFile,
} from "./features/files/api/filesApi";
import { Sidebar } from "./features/explorer/components/Sidebar";
import { SidebarResizeHandle } from "./features/explorer/components/SidebarResizeHandle";
import { FileActionBar } from "./features/file-actions/components/FileActionBar";
import {
  FileActionControls,
  type FileViewMode,
} from "./features/file-actions/components/FileActionControls";
import { FindBar } from "./features/file-actions/components/FindBar";
import { useFindInPreview } from "./features/file-actions/hooks/useFindInPreview";
import { markdown } from "./features/preview/markdown";
import { PreviewPanel } from "./features/preview/components/PreviewPanel";
import { TitleBar } from "./features/window-chrome/components/TitleBar";
import type { Entry, OpenFile } from "./shared/types/files";
import {
  fileKindFromPath,
  fileName,
  parentName,
  parentPath,
} from "./shared/utils/path";
import {
  loadAppConfiguration,
  loadAppSession,
  saveAppConfiguration,
  saveAppSession,
  type AppConfigurationState,
  type StoredWindowFrame,
} from "./shared/state/persistence";
import "./App.css";

const DEFAULT_SIDEBAR_WIDTH = 280;
const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 420;
const MIN_CONTENT_WIDTH = 420;

function clampSidebarWidth(width: number) {
  const availableMax = Math.max(
    MIN_SIDEBAR_WIDTH,
    Math.min(MAX_SIDEBAR_WIDTH, window.innerWidth - MIN_CONTENT_WIDTH),
  );

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

  return (
    locations
      .filter((location) => containsPath(location.path, path))
      .sort(
        (left, right) =>
          comparablePath(right.path).length - comparablePath(left.path).length,
      )[0] ?? null
  );
}

function App() {
  const initialConfiguration = useMemo(() => loadAppConfiguration(), []);
  const initialSession = useMemo(() => loadAppSession(), []);
  const [locations, setLocations] = useState<Entry[]>([]);
  const [activeRoot, setActiveRoot] = useState<Entry | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(initialSession.expandedPaths),
  );
  const [childrenCache, setChildrenCache] = useState<Record<string, Entry[]>>({});
  const [openFile, setOpenFile] = useState<OpenFile | null>(null);
  const [openFilePath, setOpenFilePath] = useState<string | null>(
    () => initialSession.openFilePath ?? null,
  );
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [explorerHidden, setExplorerHidden] = useState(
    () => initialConfiguration.explorerHidden ?? false,
  );
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    clampSidebarWidth(initialConfiguration.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH),
  );
  const [mode, setMode] = useState<FileViewMode>(
    () => initialConfiguration.viewMode ?? "preview",
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [barMerged, setBarMerged] = useState(
    () => initialConfiguration.barMerged ?? false,
  );
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(
    () =>
      initialSession.selectedFolderPath ??
      (initialSession.openFilePath ? parentPath(initialSession.openFilePath) : null),
  );
  const [windowFrame, setWindowFrame] = useState<StoredWindowFrame | undefined>(
    () => initialConfiguration.windowFrame,
  );
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const findTargetRef = useRef<HTMLElement | null>(null);
  const configurationRef = useRef<AppConfigurationState>({
    explorerHidden,
    sidebarWidth,
    barMerged,
    viewMode: mode,
    windowFrame,
  });

  const renderedMarkdown = useMemo(() => {
    if (!openFile || openFile.kind !== "md") {
      return "";
    }

    return markdown.render(openFile.content);
  }, [openFile]);

  const find = useFindInPreview(
    findTargetRef,
    `${openFile?.path ?? ""}:${openFile?.content ?? ""}:${mode}`,
  );

  useEffect(() => {
    const nextConfiguration: AppConfigurationState = {
      explorerHidden,
      sidebarWidth,
      barMerged,
      viewMode: mode,
      windowFrame,
    };

    configurationRef.current = nextConfiguration;
    saveAppConfiguration(nextConfiguration);
  }, [barMerged, explorerHidden, mode, sidebarWidth, windowFrame]);

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
  }, [
    activeRoot?.path,
    expanded,
    openFilePath,
    selectedFolderPath,
    sessionHydrated,
  ]);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    const unlisteners: Array<() => void> = [];
    let cancelled = false;

    async function captureWindowFrame() {
      try {
        const [size, position, maximized] = await Promise.all([
          appWindow.innerSize(),
          appWindow.outerPosition(),
          appWindow.isMaximized(),
        ]);

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

        setLocations(defaults);
        const restoredRoot =
          defaults.find(
            (location) => location.path === initialSession.activeRootPath,
          ) ??
          defaults.find(
            (location) => location.path === initialSession.selectedFolderPath,
          ) ??
          findContainingLocation(defaults, initialSession.openFilePath) ??
          findContainingLocation(defaults, initialSession.selectedFolderPath) ??
          null;
        const first = restoredRoot ?? defaults[0] ?? null;
        const restoredSelectedFolder =
          initialSession.selectedFolderPath ??
          (initialSession.openFilePath
            ? parentPath(initialSession.openFilePath)
            : first?.path ?? null);

        setActiveRoot(first);
        setSelectedFolderPath(restoredSelectedFolder);

        if (first) {
          await loadFolder(first.path);
          await Promise.all(
            initialSession.expandedPaths
              .filter((path) => path !== first.path)
              .map((path) => loadFolder(path, { quiet: true })),
          );
        }

        if (initialSession.openFilePath) {
          await openFileAtPath(initialSession.openFilePath, {
            preserveMode: true,
          });
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

  async function loadFolder(path: string, options?: { quiet?: boolean }) {
    if (childrenCache[path]) {
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

  async function openFileAtPath(
    path: string,
    options?: { preserveMode?: boolean },
  ) {
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
      if (!options?.preserveMode) {
        setMode("preview");
      }
      find.close();
    } catch (cause) {
      setError(`Unable to read file: ${String(cause)}`);
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
    await openFileAtPath(entry.path);
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
        if (nextMode === "edit") {
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

  return (
    <div className={`app-window ${explorerHidden ? "explorer-hidden" : ""}`}>
      <TitleBar
        fileActionsSlot={barMerged ? fileActionControls : null}
        explorerHidden={explorerHidden}
        rootName={activeRoot?.name}
        scopeName={openFile ? parentName(openFile.path) : null}
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
          onSelectLocation={selectLocation}
          onToggleFolder={toggleFolder}
          onSelectFile={selectFile}
        />

        <SidebarResizeHandle onPointerDown={startSidebarResize} />

        <PreviewPanel
          actionBar={
            openFile && !barMerged ? (
              <FileActionBar>{fileActionControls}</FileActionBar>
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
          renderedMarkdown={renderedMarkdown}
        />
      </div>
    </div>
  );
}

export default App;
