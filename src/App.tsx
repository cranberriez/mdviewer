import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
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
import { fileKind, parentName } from "./shared/utils/path";
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

function App() {
  const [locations, setLocations] = useState<Entry[]>([]);
  const [activeRoot, setActiveRoot] = useState<Entry | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [childrenCache, setChildrenCache] = useState<Record<string, Entry[]>>({});
  const [openFile, setOpenFile] = useState<OpenFile | null>(null);
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [explorerHidden, setExplorerHidden] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [mode, setMode] = useState<FileViewMode>("preview");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [barMerged, setBarMerged] = useState(false);
  const findTargetRef = useRef<HTMLElement | null>(null);

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
        const first = defaults[0] ?? null;
        setActiveRoot(first);
        if (first) {
          void loadFolder(first.path);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(`Unable to load default locations: ${String(cause)}`);
        }
      }
    }

    void loadLocations();

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadFolder(path: string) {
    if (childrenCache[path]) {
      return;
    }

    setError(null);
    setLoadingPaths((current) => new Set(current).add(path));

    try {
      const children = await readFolder(path);
      setChildrenCache((current) => ({ ...current, [path]: children }));
    } catch (cause) {
      setError(`Unable to read folder: ${String(cause)}`);
    } finally {
      setLoadingPaths((current) => {
        const next = new Set(current);
        next.delete(path);
        return next;
      });
    }
  }

  async function selectLocation(location: Entry) {
    setActiveRoot(location);
    setOpenFile(null);
    setExpanded(new Set());
    setError(null);
    setDirty(false);
    setMode("preview");
    setBarMerged(false);
    find.close();
    await loadFolder(location.path);
  }

  async function toggleFolder(entry: Entry) {
    const willExpand = !expanded.has(entry.path);

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
    setError(null);

    try {
      const content = await readFile(entry.path);
      setOpenFile({
        path: entry.path,
        name: entry.name,
        content,
        kind: fileKind(entry),
      });
      setDirty(false);
      setMode("preview");
      find.close();
    } catch (cause) {
      setError(`Unable to read file: ${String(cause)}`);
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
          activeFilePath={openFile?.path}
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
