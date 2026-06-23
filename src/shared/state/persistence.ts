export type StoredFileViewMode = "preview" | "edit" | "code";

export interface StoredWindowFrame {
  width: number;
  height: number;
  x: number;
  y: number;
  maximized: boolean;
}

export interface AppConfigurationState {
  explorerHidden: boolean;
  sidebarWidth: number;
  barMerged: boolean;
  viewMode: StoredFileViewMode;
  windowFrame?: StoredWindowFrame;
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

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function readViewMode(value: unknown): StoredFileViewMode | undefined {
  return value === "edit" || value === "preview" || value === "code"
    ? value
    : undefined;
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
    windowFrame: readWindowFrame(record.windowFrame),
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
