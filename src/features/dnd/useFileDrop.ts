import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { shiftPressed, startFileDrag } from "../files/api/filesApi";

/**
 * What kind of action a drop will perform. The default is "move"; holding Shift
 * during the drag switches to "copy". This default is intended to become a
 * user preference in a future settings menu (see ROADMAP #14) — the resolver is
 * isolated in `resolveDropMode` so swapping the default is a one-line change.
 */
export type DropMode = "move" | "copy";

/**
 * A resolved drop target under the cursor. `kind` selects how the drop is
 * applied; `destDir` is the folder the files land in; `label` is a short,
 * human-readable description for the overlay (e.g. a folder name or "root").
 */
export interface DropTarget {
  /**
   * - "tree-folder": a folder row in the explorer tree (or a file row, whose
   *   parent folder is used) — files are copied/moved into `destDir`.
   * - "tree-root": blank tree space / the active root — into the root folder.
   * - "main-file": the main content area, when a single supported file is
   *   dragged — it opens directly (no copy/move).
   * - "main-folder": the main content area, when a folder is dragged — it
   *   becomes the new active root.
   * - "home-file" / "home-folder": the Home screen, mirroring the main-area
   *   behaviour (open the file / set the folder as root). A lone file dropped
   *   here is additionally remembered as a rootless Recent.
   */
  kind:
    | "tree-folder"
    | "tree-root"
    | "main-file"
    | "main-folder"
    | "home-file"
    | "home-folder";
  destDir: string;
  label: string;
}

/** Live drag state, consumed by the UI to render overlays and highlights. */
export interface DropState {
  /** True while an OS drag is hovering somewhere over the window. */
  active: boolean;
  /** The resolved target under the cursor, or null if over nothing droppable. */
  target: DropTarget | null;
  /** Resolved action for tree drops (copy/move). Irrelevant for main-area opens. */
  mode: DropMode;
  /** The dragged file system paths. */
  paths: string[];
  /** Path of the active root, used to flag files dragged in from outside it. */
  activeRootPath: string | null;
}

const EMPTY_STATE: DropState = {
  active: false,
  target: null,
  mode: "move",
  paths: [],
  activeRootPath: null,
};

/**
 * Default drop action. Move by default; Shift inverts it to copy. Centralised
 * here so a future preference (swap the default) only touches this function.
 */
function resolveDropMode(shiftHeld: boolean): DropMode {
  const defaultMode: DropMode = "move";
  if (!shiftHeld) {
    return defaultMode;
  }
  return defaultMode === "move" ? "copy" : "move";
}

/** Marker put on droppable DOM nodes so we can hit-test the OS cursor against them. */
export const DROP_ZONE_ATTR = "data-drop-zone";

export interface FileDropCallbacks {
  /** The active explorer root path, or null. */
  activeRootPath: string | null;
  /**
   * Resolve the DOM element under the cursor into a logical drop target. Called
   * on every drag-over. Returning null means "nothing droppable here".
   */
  resolveTarget: (element: Element | null) => DropTarget | null;
  /** Perform a tree copy/move drop of `paths` into `target.destDir`. */
  onTreeDrop: (paths: string[], target: DropTarget, mode: DropMode) => void;
  /** Open a single file dropped on the main area. */
  onOpenFile: (path: string) => void;
  /** Set a dropped folder as the new active root. */
  onSetRoot: (path: string) => void;
  /**
   * Handle a drop on the Home screen. `path` is the first dragged item; the
   * handler decides file-vs-folder (open file as a rootless recent, or set
   * folder as root) the same way the main area does.
   */
  onHomeDrop?: (path: string) => void;
}

/**
 * Centralised OS file drag-and-drop controller.
 *
 * Tauri delivers native OS file drops as a single window-level event stream
 * (`onDragDropEvent`) carrying absolute paths and a *physical* cursor position
 * — there is no per-element HTML5 drop event for real files, and the webview
 * suppresses the browser's own drag events. So we hit-test the cursor against
 * the DOM ourselves (`elementFromPoint`) and dispatch to the matching target.
 *
 * Shift is tracked live during the drag to flip move ⇄ copy, with the resolved
 * mode surfaced for the overlay UI.
 */
export function useFileDrop({
  activeRootPath,
  resolveTarget,
  onTreeDrop,
  onOpenFile,
  onSetRoot,
  onHomeDrop,
}: FileDropCallbacks): FileDropController {
  const [state, setState] = useState<DropState>(EMPTY_STATE);

  // Live Shift state. Kept in a ref so the drag handlers always read the latest
  // value without re-subscribing, and mirrored into React state so the overlay
  // re-renders when the user presses/releases Shift mid-drag.
  //
  // Two sources feed this: the window keyboard listener (instant, but only when
  // our window is focused) and an OS-level poll (`shiftPressed`) refreshed on
  // every drag event so a drag started from *another* window still tracks Shift.
  const shiftRef = useRef(false);
  // Latest dragged paths, so a `drop` event (which may omit them on some
  // platforms) can fall back to what `enter`/`over` reported.
  const pathsRef = useRef<string[]>([]);

  // Keep the newest callbacks without re-subscribing the Tauri listener.
  const callbacksRef = useRef<FileDropCallbacks>({
    activeRootPath,
    resolveTarget,
    onTreeDrop,
    onOpenFile,
    onSetRoot,
    onHomeDrop,
  });
  callbacksRef.current = {
    activeRootPath,
    resolveTarget,
    onTreeDrop,
    onOpenFile,
    onSetRoot,
    onHomeDrop,
  };

  // Resolve the target under a physical cursor position and update state.
  const updateFromPosition = useCallback((physicalX: number, physicalY: number, paths: string[]) => {
    // Tauri positions are physical pixels; elementFromPoint wants CSS pixels.
    const ratio = window.devicePixelRatio || 1;
    const x = physicalX / ratio;
    const y = physicalY / ratio;

    const element = document.elementFromPoint(x, y);
    const target = callbacksRef.current.resolveTarget(element);

    setState({
      active: true,
      target,
      mode: resolveDropMode(shiftRef.current),
      paths,
      activeRootPath: callbacksRef.current.activeRootPath,
    });
  }, []);

  // ---- Internal (in-window) drag ----------------------------------------
  //
  // The window runs with Tauri's native drag-drop enabled (so external file
  // drags arrive via `onDragDropEvent` with absolute paths). On Windows that
  // setting *disables* the webview's HTML5 drag events, so we can't use
  // `dragstart`/`dragover` for in-app drags. Instead we drive a custom drag from
  // raw pointer events: while the pointer stays in the window we update the same
  // overlays as an external drag; on release we perform the move/copy; if the
  // pointer leaves the window we escalate to a real native OS drag
  // (`startFileDrag`) so the item can land in Explorer or another app.
  //
  // Kept in refs so the window-level listeners always read the latest values.
  const internalRef = useRef<{
    paths: string[];
    isFolder: boolean;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);
  const internalCleanupRef = useRef<(() => void) | null>(null);
  const escalatedRef = useRef(false);

  // Pixels the pointer must travel before a press becomes a drag (so a plain
  // click to open a file isn't treated as a drag).
  const DRAG_THRESHOLD = 5;

  const beginInternalDrag = useCallback(
    (items: { path: string; isDir: boolean }[], event: ReactPointerEvent) => {
      // Only the primary (left) button starts a drag; let right-click etc. pass
      // through to selection / context menus.
      if (items.length === 0 || event.button !== 0) {
        return;
      }
      // Tear down any listeners from a prior, un-cleared gesture first.
      internalCleanupRef.current?.();
      const paths = items.map((item) => item.path);
      const isFolder = items.some((item) => item.isDir);
      internalRef.current = {
        paths,
        isFolder,
        startX: event.clientX,
        startY: event.clientY,
        dragging: false,
      };
      escalatedRef.current = false;
      shiftRef.current = event.shiftKey;

      function clear() {
        internalRef.current = null;
        internalCleanupRef.current?.();
        internalCleanupRef.current = null;
        document.body.style.removeProperty("cursor");
        setState(EMPTY_STATE);
      }

      function pointerLeftWindow(x: number, y: number) {
        return x <= 0 || y <= 0 || x >= window.innerWidth || y >= window.innerHeight;
      }

      function onPointerMove(move: PointerEvent) {
        const current = internalRef.current;
        if (!current || escalatedRef.current) {
          return;
        }
        shiftRef.current = move.shiftKey;

        // Promote to an actual drag only once past the movement threshold.
        if (!current.dragging) {
          const dx = move.clientX - current.startX;
          const dy = move.clientY - current.startY;
          if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) {
            return;
          }
          current.dragging = true;
          document.body.style.cursor = "grabbing";
        }

        // Left the window → hand off to a native OS drag for Explorer / others.
        if (pointerLeftWindow(move.clientX, move.clientY)) {
          escalatedRef.current = true;
          const mode = resolveDropMode(shiftRef.current);
          void startFileDrag(current.paths, { mode, isFolder: current.isFolder });
          clear();
          return;
        }

        const element = document.elementFromPoint(move.clientX, move.clientY);
        const target = callbacksRef.current.resolveTarget(element);
        setState({
          active: true,
          target,
          mode: resolveDropMode(shiftRef.current),
          paths: current.paths,
          activeRootPath: callbacksRef.current.activeRootPath,
        });
      }

      function onPointerUp(up: PointerEvent) {
        const current = internalRef.current;
        if (!current) {
          return;
        }
        const didDrag = current.dragging;
        // A press that never crossed the threshold is a click, not a drag —
        // leave it to the row's own onClick.
        if (current.dragging && !escalatedRef.current) {
          const element = document.elementFromPoint(up.clientX, up.clientY);
          const target = callbacksRef.current.resolveTarget(element);
          dispatchDropRef.current(target, current.paths, resolveDropMode(up.shiftKey));
        }
        clear();

        // After a real drag the browser still fires a click on the origin row;
        // swallow that one click so it doesn't also open/toggle the entry.
        if (didDrag) {
          const swallow = (click: MouseEvent) => {
            click.stopPropagation();
            click.preventDefault();
            window.removeEventListener("click", swallow, true);
          };
          window.addEventListener("click", swallow, true);
          // Safety: if no click arrives, drop the listener on the next frame.
          setTimeout(() => window.removeEventListener("click", swallow, true), 0);
        }
      }

      function onPointerCancel() {
        clear();
      }

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerCancel);
      internalCleanupRef.current = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerCancel);
      };
    },
    [],
  );

  // Apply a resolved drop target (shared by native and internal drop paths).
  function dispatchDrop(target: DropTarget | null, paths: string[], mode: DropMode) {
    if (!target || paths.length === 0) {
      return;
    }
    if (target.kind === "tree-folder" || target.kind === "tree-root") {
      callbacksRef.current.onTreeDrop(paths, target, mode);
    } else if (target.kind === "main-file") {
      callbacksRef.current.onOpenFile(paths[0]);
    } else if (target.kind === "main-folder") {
      callbacksRef.current.onSetRoot(paths[0]);
    } else if (target.kind === "home-file" || target.kind === "home-folder") {
      callbacksRef.current.onHomeDrop?.(paths[0]);
    }
  }
  // Keep a stable ref so the native listener can reuse the same dispatch.
  const dispatchDropRef = useRef(dispatchDrop);
  dispatchDropRef.current = dispatchDrop;

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    // Track Shift live so the copy/move badge updates without cursor movement.
    function refreshMode() {
      setState((current) => (current.active ? { ...current, mode: resolveDropMode(shiftRef.current) } : current));
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Shift") {
        shiftRef.current = event.type === "keydown";
        refreshMode();
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);

    // Poll the OS-level Shift state during a drag so it stays correct even when
    // the drag began in another, focused window (no key events reach us then).
    // Guarded so a slow/failed invoke never throws into the drag handler.
    function pollShiftFromOs() {
      void shiftPressed()
        .then((held) => {
          if (disposed || held === shiftRef.current) {
            return;
          }
          shiftRef.current = held;
          refreshMode();
        })
        .catch(() => undefined);
    }

    void getCurrentWebview()
      .onDragDropEvent((event) => {
        if (disposed) {
          return;
        }

        const payload = event.payload;

        if (payload.type === "enter" || payload.type === "over") {
          if ("paths" in payload && Array.isArray(payload.paths) && payload.paths.length > 0) {
            pathsRef.current = payload.paths;
          }
          // Refresh Shift from the OS (covers cross-window drags); the result
          // updates the badge a frame later via refreshMode.
          pollShiftFromOs();
          const position = payload.position;
          updateFromPosition(position.x, position.y, pathsRef.current);
          return;
        }

        if (payload.type === "leave") {
          pathsRef.current = [];
          setState(EMPTY_STATE);
          return;
        }

        if (payload.type === "drop") {
          const paths =
            "paths" in payload && Array.isArray(payload.paths) && payload.paths.length > 0
              ? payload.paths
              : pathsRef.current;
          const position = payload.position;

          const ratio = window.devicePixelRatio || 1;
          const element = document.elementFromPoint(position.x / ratio, position.y / ratio);
          const target = callbacksRef.current.resolveTarget(element);
          const mode = resolveDropMode(shiftRef.current);

          dispatchDropRef.current(target, paths, mode);

          pathsRef.current = [];
          setState(EMPTY_STATE);
        }
      })
      .then((dispose) => {
        if (disposed) {
          dispose();
        } else {
          unlisten = dispose;
        }
      })
      .catch(() => {
        // Drag-drop is best effort and unavailable outside the Tauri runtime.
      });

    return () => {
      disposed = true;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      unlisten?.();
    };
  }, [updateFromPosition]);

  // Ensure internal-drag listeners are torn down if the component unmounts mid-drag.
  useEffect(() => () => internalCleanupRef.current?.(), []);

  return { state, beginInternalDrag };
}

/** Return shape of {@link useFileDrop}. */
export interface FileDropController {
  /** Live drag state for overlays/highlights (native and internal drags). */
  state: DropState;
  /**
   * Start an in-window drag from an explorer row. Drives the app's overlays from
   * pointer events while the cursor stays in the window, and escalates to a
   * native OS drag when the pointer leaves it. Call from the element's
   * `onPointerDown`.
   */
  beginInternalDrag: (items: { path: string; isDir: boolean }[], event: ReactPointerEvent) => void;
}
