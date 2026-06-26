import type { Entry, EntryKind } from "../types/files";

export type StoredFileViewMode = "preview" | "edit" | "code";

export interface StoredWindowFrame {
  width: number;
  height: number;
  x: number;
  y: number;
  maximized: boolean;
}

export type AppTheme = "dark" | "light";

export interface ExplorerHeaderActionsVisibility {
  newFile: boolean;
  newFolder: boolean;
  refresh: boolean;
}

export interface SourcesHeaderActionsVisibility {
  search: boolean;
  outline: boolean;
  recent: boolean;
  pin: boolean;
}

export const DEFAULT_EXPLORER_HEADER_ACTIONS_VISIBLE: ExplorerHeaderActionsVisibility = {
  newFile: true,
  newFolder: true,
  refresh: true,
};

export const DEFAULT_SOURCES_HEADER_ACTIONS_VISIBLE: SourcesHeaderActionsVisibility = {
  search: true,
  outline: true,
  recent: true,
  pin: true,
};

export type SourceHeaderActionsVisible = SourcesHeaderActionsVisibility;

export interface NavigationHistoryRoot {
  path: string;
  name: string;
}

export interface NavigationHistoryFile {
  path: string;
  name: string;
  kind: Exclude<EntryKind, "folder">;
}

export type NavigationHistoryItem =
  | {
      kind: "root";
      root: NavigationHistoryRoot;
    }
  | {
      kind: "file";
      root?: NavigationHistoryRoot;
      file: NavigationHistoryFile;
    };

/** The last file opened within a recent root, if any. */
export interface RecentFile {
  path: string;
  name: string;
  kind: Exclude<EntryKind, "folder">;
}

/**
 * A recent entry surfaced on the Home screen. Two shapes share one list:
 *
 * - **Root** (`kind` omitted or `"root"`) — a recently used root folder. There
 *   is at most one entry per root: opening files within a root updates that
 *   root's `lastFile` rather than creating new entries.
 * - **File** (`kind: "file"`) — a single file opened *without* a root (only via
 *   dropping a lone file onto the Home screen). `path` is the file itself,
 *   `fileKind` drives its icon, and `lastFile` is unused. Clicking it just
 *   reopens that file; no root is selected.
 *
 * `kind` is optional for backward compatibility: entries persisted before this
 * field existed are roots, and `recentItemKind` treats a missing value as such.
 */
export interface RecentItem {
  /** "root" (default) or "file". Optional so pre-existing data reads as a root. */
  kind?: "root" | "file";
  /** Absolute path of the root folder, or of the file for `kind: "file"`. */
  path: string;
  /** Display name of the folder, or of the file for `kind: "file"`. */
  name: string;
  /** For `kind: "file"`, the file's kind (drives its icon). */
  fileKind?: Exclude<EntryKind, "folder">;
  /** The most-recently-opened file within this root, or undefined if the root
   *  was selected but no file was ever opened. Unused for `kind: "file"`. */
  lastFile?: RecentFile;
  /** Epoch millis when this root was last touched; drives ordering. */
  openedAt: number;
}

/** A recent entry's effective kind, treating legacy (missing) values as roots. */
export function recentItemKind(item: RecentItem): "root" | "file" {
  return item.kind === "file" ? "file" : "root";
}

/** Maximum number of recent roots kept on the Home screen. */
export const MAX_RECENTS = 5;

/** Maximum number of source navigation history entries kept. */
export const MAX_NAVIGATION_HISTORY = 50;

export interface AppConfigurationState {
  explorerHidden: boolean;
  /** Whether the floating left-side outline panel is shown. */
  outlinePanelVisible?: boolean;
  sidebarWidth: number;
  barMerged: boolean;
  viewMode: StoredFileViewMode;
  theme?: AppTheme;
  windowFrame?: StoredWindowFrame;
  /** Folders the user explicitly pinned to Saved (beyond the defaults). */
  pinnedLocations?: Entry[];
  /** Paths of default locations (e.g. Documents) the user has unpinned. */
  removedDefaultPaths?: string[];
  /** Custom icon name per saved-location path. Home icon is never stored here. */
  locationIcons?: Record<string, string>;
  /** True once the user has completed (or skipped) first-run onboarding. */
  onboardingCompleted?: boolean;
  /** Optional display name from onboarding, used to greet on the Home screen. */
  userName?: string;
  /** Recently opened files and roots, newest first, capped at MAX_RECENTS. */
  recents?: RecentItem[];
  /** Visibility of compact action buttons in the Explorer section header. */
  explorerHeaderActionsVisible?: ExplorerHeaderActionsVisibility;
  /** Visibility of optional buttons in the Sources header. */
  sourcesHeaderActionsVisible?: SourcesHeaderActionsVisibility;
}

export interface AppSessionState {
  activeRootPath?: string;
  selectedFolderPath?: string;
  openFilePath?: string;
  expandedPaths: string[];
  navigationHistory?: NavigationHistoryItem[];
  navigationHistoryIndex?: number;
}

const CONFIGURATION_KEY = "mdviewer.configuration.v1";
const SESSION_KEY = "mdviewer.session.v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRecord(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeRecord(key: string, value: unknown) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Persistence should never break the viewer itself.
  }
}

function readString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string => typeof item === "string" && item.length > 0,
  );
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(value)) {
    if (typeof val === "string" && val.length > 0) {
      result[key] = val;
    }
  }
  return result;
}

function readEntry(value: unknown): Entry | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = readString(value.name);
  const path = readString(value.path);
  const kind = value.kind;

  if (
    name === undefined ||
    path === undefined ||
    typeof value.is_dir !== "boolean" ||
    (kind !== "folder" && kind !== "md" && kind !== "text")
  ) {
    return null;
  }

  return { name, path, is_dir: value.is_dir, kind };
}

function readEntryArray(value: unknown): Entry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(readEntry)
    .filter((entry): entry is Entry => entry !== null);
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function readExplorerHeaderActionsVisibility(
  value: unknown,
): ExplorerHeaderActionsVisibility | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    newFile: readBoolean(value.newFile) ?? DEFAULT_EXPLORER_HEADER_ACTIONS_VISIBLE.newFile,
    newFolder: readBoolean(value.newFolder) ?? DEFAULT_EXPLORER_HEADER_ACTIONS_VISIBLE.newFolder,
    refresh: readBoolean(value.refresh) ?? DEFAULT_EXPLORER_HEADER_ACTIONS_VISIBLE.refresh,
  };
}

function readSourcesHeaderActionsVisibility(
  value: unknown,
): SourcesHeaderActionsVisibility | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    search: readBoolean(value.search) ?? DEFAULT_SOURCES_HEADER_ACTIONS_VISIBLE.search,
    outline: readBoolean(value.outline) ?? DEFAULT_SOURCES_HEADER_ACTIONS_VISIBLE.outline,
    recent: readBoolean(value.recent) ?? DEFAULT_SOURCES_HEADER_ACTIONS_VISIBLE.recent,
    pin: readBoolean(value.pin) ?? DEFAULT_SOURCES_HEADER_ACTIONS_VISIBLE.pin,
  };
}

function readRecentKind(value: unknown): Exclude<EntryKind, "folder"> | undefined {
  return value === "md" || value === "text" ? value : undefined;
}

function readRecentFile(value: unknown): RecentFile | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const path = readString(value.path);
  const name = readString(value.name);
  const kind = readRecentKind(value.kind);

  if (path === undefined || name === undefined || kind === undefined) {
    return undefined;
  }

  return { path, name, kind };
}

function readRecent(value: unknown): RecentItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const path = readString(value.path);
  const name = readString(value.name);
  const openedAt = readNumber(value.openedAt);

  if (path === undefined || name === undefined || openedAt === undefined) {
    return null;
  }

  // A persisted "file" recent carries kind:"file" and a fileKind; anything else
  // (including legacy data with no kind) is a root.
  const isFile = value.kind === "file";

  return {
    kind: isFile ? "file" : "root",
    path,
    name,
    fileKind: isFile ? readRecentKind(value.fileKind) : undefined,
    lastFile: isFile ? undefined : readRecentFile(value.lastFile),
    openedAt,
  };
}

function readNavigationHistoryRoot(value: unknown): NavigationHistoryRoot | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const path = readString(value.path);
  const name = readString(value.name);

  if (path === undefined || name === undefined) {
    return undefined;
  }

  return { path, name };
}

function readNavigationHistoryFile(value: unknown): NavigationHistoryFile | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const path = readString(value.path);
  const name = readString(value.name);
  const kind = readRecentKind(value.kind);

  if (path === undefined || name === undefined || kind === undefined) {
    return undefined;
  }

  return { path, name, kind };
}

function readNavigationHistoryItem(value: unknown): NavigationHistoryItem | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.kind === "root") {
    const root = readNavigationHistoryRoot(value.root);
    return root ? { kind: "root", root } : null;
  }

  if (value.kind === "file") {
    const file = readNavigationHistoryFile(value.file);
    const root = readNavigationHistoryRoot(value.root);
    return file ? { kind: "file", file, root } : null;
  }

  return null;
}

function readNavigationHistory(value: unknown): NavigationHistoryItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(readNavigationHistoryItem)
    .filter((item): item is NavigationHistoryItem => item !== null)
    .slice(-MAX_NAVIGATION_HISTORY);
}

function readRecents(value: unknown): RecentItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(readRecent)
    .filter((item): item is RecentItem => item !== null)
    .sort((left, right) => right.openedAt - left.openedAt)
    .slice(0, MAX_RECENTS);
}

/** Normalize a root path for stable, case-insensitive comparison. */
function recentKey(path: string) {
  return path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

/**
 * Touch a recent root (e.g. when it's selected): move it to the top, preserving
 * any existing `lastFile`. Creates the entry if it doesn't exist yet. Pure.
 */
export function touchRecentRoot(
  current: RecentItem[],
  root: { path: string; name: string },
): RecentItem[] {
  const key = recentKey(root.path);
  const existing = current.find(
    (item) => recentItemKind(item) === "root" && recentKey(item.path) === key,
  );
  const next: RecentItem = {
    kind: "root",
    path: root.path,
    name: root.name,
    lastFile: existing?.lastFile,
    openedAt: Date.now(),
  };
  const rest = current.filter(
    (item) => !(recentItemKind(item) === "root" && recentKey(item.path) === key),
  );
  return [next, ...rest].slice(0, MAX_RECENTS);
}

/**
 * Record a lone file opened with no root (only happens when a single file is
 * dropped onto the Home screen). Upserts a `kind: "file"` entry keyed by the
 * file path and moves it to the top. This is the only path that adds a single
 * file to the recents list. Pure.
 */
export function recordRecentSingleFile(
  current: RecentItem[],
  file: { path: string; name: string; kind: Exclude<EntryKind, "folder"> },
): RecentItem[] {
  const key = recentKey(file.path);
  const next: RecentItem = {
    kind: "file",
    path: file.path,
    name: file.name,
    fileKind: file.kind,
    openedAt: Date.now(),
  };
  const rest = current.filter(
    (item) => !(recentItemKind(item) === "file" && recentKey(item.path) === key),
  );
  return [next, ...rest].slice(0, MAX_RECENTS);
}

/**
 * Record a file open within a root: upserts the root entry, sets its `lastFile`,
 * and moves it to the top. Pure.
 */
export function recordRecentFile(
  current: RecentItem[],
  root: { path: string; name: string },
  file: RecentFile,
): RecentItem[] {
  const key = recentKey(root.path);
  const next: RecentItem = {
    kind: "root",
    path: root.path,
    name: root.name,
    lastFile: file,
    openedAt: Date.now(),
  };
  const rest = current.filter(
    (item) => !(recentItemKind(item) === "root" && recentKey(item.path) === key),
  );
  return [next, ...rest].slice(0, MAX_RECENTS);
}

/**
 * Remove a recent entry, returning a new list. Matches on both path and kind so
 * a file recent and a root recent that happen to share a path don't collide.
 */
export function removeRecent(
  current: RecentItem[],
  target: { path: string; kind: "root" | "file" },
): RecentItem[] {
  const key = recentKey(target.path);
  return current.filter(
    (item) => !(recentItemKind(item) === target.kind && recentKey(item.path) === key),
  );
}

function readViewMode(value: unknown): StoredFileViewMode | undefined {
  return value === "edit" || value === "preview" || value === "code"
    ? value
    : undefined;
}

function readTheme(value: unknown): AppTheme | undefined {
  return value === "dark" || value === "light" ? value : undefined;
}

function readWindowFrame(value: unknown): StoredWindowFrame | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const width = readNumber(value.width);
  const height = readNumber(value.height);
  const x = readNumber(value.x);
  const y = readNumber(value.y);
  const maximized = readBoolean(value.maximized);

  if (
    width === undefined ||
    height === undefined ||
    x === undefined ||
    y === undefined ||
    maximized === undefined
  ) {
    return undefined;
  }

  return { width, height, x, y, maximized };
}

export function loadAppConfiguration(): Partial<AppConfigurationState> {
  const record = readRecord(CONFIGURATION_KEY);
  if (!record) {
    return {};
  }

  return {
    explorerHidden: readBoolean(record.explorerHidden),
    outlinePanelVisible: readBoolean(record.outlinePanelVisible),
    sidebarWidth: readNumber(record.sidebarWidth),
    barMerged: readBoolean(record.barMerged),
    viewMode: readViewMode(record.viewMode),
    theme: readTheme(record.theme),
    windowFrame: readWindowFrame(record.windowFrame),
    pinnedLocations: readEntryArray(record.pinnedLocations),
    removedDefaultPaths: readStringArray(record.removedDefaultPaths),
    locationIcons: readStringRecord(record.locationIcons),
    onboardingCompleted: readBoolean(record.onboardingCompleted),
    userName: readString(record.userName),
    recents: readRecents(record.recents),
    explorerHeaderActionsVisible: readExplorerHeaderActionsVisibility(
      record.explorerHeaderActionsVisible,
    ),
    sourcesHeaderActionsVisible: readSourcesHeaderActionsVisibility(
      record.sourcesHeaderActionsVisible,
    ),
  };
}

export function saveAppConfiguration(configuration: AppConfigurationState) {
  writeRecord(CONFIGURATION_KEY, configuration);
}

export function loadAppSession(): AppSessionState {
  const record = readRecord(SESSION_KEY);
  if (!record) {
    return { expandedPaths: [] };
  }

  return {
    activeRootPath: readString(record.activeRootPath),
    selectedFolderPath: readString(record.selectedFolderPath),
    openFilePath: readString(record.openFilePath),
    expandedPaths: readStringArray(record.expandedPaths),
    navigationHistory: readNavigationHistory(record.navigationHistory),
    navigationHistoryIndex: readNumber(record.navigationHistoryIndex),
  };
}

export function saveAppSession(session: AppSessionState) {
  writeRecord(SESSION_KEY, session);
}
