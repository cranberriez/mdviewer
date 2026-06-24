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

/** The last file opened within a recent root, if any. */
export interface RecentFile {
  path: string;
  name: string;
  kind: Exclude<EntryKind, "folder">;
}

/**
 * A recently used root folder, surfaced on the Home screen. There is at most one
 * entry per root: opening files within a root updates that root's `lastFile`
 * rather than creating new entries.
 */
export interface RecentItem {
  /** Absolute path of the root folder. */
  path: string;
  /** Display name of the root folder. */
  name: string;
  /** The most-recently-opened file within this root, or undefined if the root
   *  was selected but no file was ever opened. */
  lastFile?: RecentFile;
  /** Epoch millis when this root was last touched; drives ordering. */
  openedAt: number;
}

/** Maximum number of recent roots kept. */
export const MAX_RECENTS = 5;

export interface AppConfigurationState {
  explorerHidden: boolean;
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
}

export interface AppSessionState {
  activeRootPath?: string;
  selectedFolderPath?: string;
  openFilePath?: string;
  expandedPaths: string[];
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

  return {
    path,
    name,
    lastFile: readRecentFile(value.lastFile),
    openedAt,
  };
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
  const existing = current.find((item) => recentKey(item.path) === key);
  const next: RecentItem = {
    path: root.path,
    name: root.name,
    lastFile: existing?.lastFile,
    openedAt: Date.now(),
  };
  const rest = current.filter((item) => recentKey(item.path) !== key);
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
    path: root.path,
    name: root.name,
    lastFile: file,
    openedAt: Date.now(),
  };
  const rest = current.filter((item) => recentKey(item.path) !== key);
  return [next, ...rest].slice(0, MAX_RECENTS);
}

/** Remove a recent root by path, returning a new list. */
export function removeRecent(current: RecentItem[], rootPath: string): RecentItem[] {
  const key = recentKey(rootPath);
  return current.filter((item) => recentKey(item.path) !== key);
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
  };
}

export function saveAppSession(session: AppSessionState) {
  writeRecord(SESSION_KEY, session);
}
