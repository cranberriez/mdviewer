import { Channel, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Entry, FileSearchResponse } from "../../../shared/types/files";
import type { ExplorerFilterOptions } from "../../../shared/state/persistence";

export function defaultLocations() {
  return invoke<Entry[]>("default_locations");
}

export function readFolder(path: string, options?: ExplorerFilterOptions) {
  return invoke<Entry[]>("read_dir", {
    path,
    showHidden: options?.showHiddenItems ?? false,
    showNonTextFiles: options?.showNonTextFiles ?? false,
  });
}

export function readFile(path: string) {
  return invoke<string>("read_file", { path });
}

export function searchFiles(root: string, query: string) {
  return invoke<FileSearchResponse>("search_files", { root, query });
}

export function writeFile(path: string, content: string) {
  return invoke<void>("write_file", { path, content });
}

export function createFile(path: string) {
  return invoke<void>("create_file", { path });
}

export function createFolder(path: string) {
  return invoke<void>("create_folder", { path });
}

export function renamePath(from: string, to: string) {
  return invoke<void>("rename_path", { from, to });
}

export function deletePath(path: string) {
  return invoke<void>("delete_path", { path });
}

/**
 * Copy a file/folder into a destination directory. Returns the final
 * destination path (de-duplicated with a " (copy)" suffix on name collision).
 */
export function copyPath(source: string, destDir: string) {
  return invoke<string>("copy_path", { source, destDir });
}

/**
 * Move a file/folder into a destination directory. Returns the final
 * destination path. No-ops if the item already lives in that directory.
 */
export function movePath(source: string, destDir: string) {
  return invoke<string>("move_path", { source, destDir });
}

/**
 * Whether Shift is currently held, read at the OS level so it stays accurate
 * during a drag started from another window (where the webview gets no key
 * events). Returns false on non-Windows platforms.
 */
export function shiftPressed() {
  return invoke<boolean>("shift_pressed");
}

export function revealInExplorer(path: string) {
  return invoke<void>("reveal_in_explorer", { path });
}

/**
 * Drag-cursor preview icons (base64 PNG data URLs), inlined so the drag has no
 * runtime file dependency. A 48px document glyph for files and a folder glyph
 * for folders — sized like a real file icon rather than a small cursor marker.
 * The native plugin accepts a `data:image/png;base64,` string.
 */
const DRAG_FILE_ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAiUlEQVR42u3ZsQ2AQAxD0ZuTigGYh4oBWIaGkiEQEgPAClfYDkLfkgd4SpQrrjVCSFeGcXpULQOc1y1pCUIJ2PYjj1AD4ggHIIpwAWIIJyCCcAPsiATAikgBbAgloOSx+yVgXlZJmQAAAAC4QqwQAABcISYAAAAArhArBAAAAAAAvgxIl995EsgLjxnAQC/KdDoAAAAASUVORK5CYII=";
const DRAG_FOLDER_ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAV0lEQVR42u3YMRGAMBBE0QhD2ImgjiIUoCE1Fi4WyNBchvdnVsBrtzVJklS45z7zywAAdgX0OLLalgHjijIDAAAAAAAAAAAAAAAAAAAAAAD4xzMnSXrTBAcsmcYLGjuXAAAAAElFTkSuQmCC";

/**
 * Start a native OS drag-and-drop operation carrying real files OUT of the
 * window, so the dragged paths can be dropped onto Windows Explorer, the
 * desktop, or any other application exactly like dragging within the file
 * manager.
 *
 * `mode` sets the action hint the OS shows (the +badge on the cursor): "move"
 * removes the source on drop, "copy" leaves it. Mirrors the in-app convention
 * (move by default, Shift = copy). `isFolder` picks the folder vs. file preview
 * glyph for the drag cursor.
 *
 * Backed by `tauri-plugin-drag`'s `start_drag` command (invoked directly to
 * avoid an extra JS dependency). The command streams drag results over a
 * Channel, which we accept but ignore. Best-effort: rejects silently outside the
 * Tauri runtime so it's safe to call from UI handlers.
 */
export async function startFileDrag(
  paths: string[],
  options?: { mode?: "move" | "copy"; isFolder?: boolean },
): Promise<void> {
  if (paths.length === 0) {
    return;
  }
  // The plugin requires a Channel for drag-event callbacks even when unused.
  const onEvent = new Channel<unknown>();
  try {
    await invoke("plugin:drag|start_drag", {
      item: paths,
      image: options?.isFolder ? DRAG_FOLDER_ICON : DRAG_FILE_ICON,
      options: { mode: options?.mode ?? "move" },
      onEvent,
    });
  } catch {
    // Drag-out is best effort and unavailable outside the Tauri runtime.
  }
}

export function folderEntry(path: string) {
  return invoke<Entry>("folder_entry", { path });
}

/**
 * Resolve a link target (from a rendered markdown link) against the directory of
 * the file it appears in, returning an absolute canonical path. Rejects if the
 * target does not exist.
 */
export function resolveLinkPath(baseFile: string, target: string) {
  return invoke<string>("resolve_link_path", { baseFile, target });
}

/**
 * Open the native directory picker and return the chosen folder as an Entry,
 * or null if the user cancelled.
 */
export async function pickFolder(): Promise<Entry | null> {
  const selected = await open({ directory: true, multiple: false });
  if (typeof selected !== "string") {
    return null;
  }

  return folderEntry(selected);
}
