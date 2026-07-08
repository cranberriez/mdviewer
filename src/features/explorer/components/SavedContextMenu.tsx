import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CornerUpLeft, Link2, Palette, PinOff } from "lucide-react";
import type { Entry } from "../../../shared/types/files";

export type SavedMenuAction =
  | "reveal"
  | "copy-path"
  | "copy-relative-path"
  | "change-icon"
  | "unpin";

interface SavedContextMenuProps {
  location: Entry;
  x: number;
  y: number;
  /** Whether this location may be unpinned (Home cannot). */
  canUnpin: boolean;
  onAction: (action: SavedMenuAction, location: Entry) => void;
  onClose: () => void;
}

const VIEWPORT_PADDING = 8;

export function SavedContextMenu({
  location,
  x,
  y,
  canUnpin,
  onAction,
  onClose,
}: SavedContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ x, y });
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) {
      return;
    }

    const { offsetWidth: width, offsetHeight: height } = menu;
    let nextX = x;
    let nextY = y;

    if (nextX + width + VIEWPORT_PADDING > window.innerWidth) {
      nextX = Math.max(VIEWPORT_PADDING, window.innerWidth - width - VIEWPORT_PADDING);
    }
    if (nextY + height + VIEWPORT_PADDING > window.innerHeight) {
      nextY = Math.max(VIEWPORT_PADDING, window.innerHeight - height - VIEWPORT_PADDING);
    }

    setPosition({ x: nextX, y: nextY });
    setReady(true);
  }, [x, y, location.path]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("contextmenu", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", onClose);
    window.addEventListener("resize", onClose);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("contextmenu", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", onClose);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const dispatch = (action: SavedMenuAction) => {
    onAction(action, location);
    // "change-icon" lets the parent close the menu after positioning the picker.
    if (action !== "change-icon") {
      onClose();
    }
  };

  return createPortal(
    <div
      ref={menuRef}
      className={`ctx-menu ${ready ? "show" : ""}`}
      role="menu"
      style={{ left: position.x, top: position.y }}
    >
      <button
        type="button"
        role="menuitem"
        className="ctx-item"
        onClick={() => dispatch("reveal")}
      >
        <span className="ci-ico">
          <CornerUpLeft size={15} />
        </span>
        <span className="ci-label">Reveal in File Explorer</span>
        <span className="ci-key">Shift+Alt+R</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="ctx-item"
        onClick={() => dispatch("copy-path")}
      >
        <span className="ci-ico">
          <Link2 size={15} />
        </span>
        <span className="ci-label">Copy Path</span>
        <span className="ci-key">Shift+Alt+C</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="ctx-item"
        onClick={() => dispatch("copy-relative-path")}
      >
        <span className="ci-ico">
          <Link2 size={15} />
        </span>
        <span className="ci-label">Copy Relative Path</span>
      </button>

      <button
        type="button"
        role="menuitem"
        className="ctx-item"
        disabled={!canUnpin}
        title={canUnpin ? undefined : "Home icon cannot be changed"}
        onClick={() => {
          if (!canUnpin) return;
          dispatch("change-icon");
        }}
      >
        <span className="ci-ico">
          <Palette size={15} />
        </span>
        <span className="ci-label">Change Icon</span>
      </button>

      <div className="ctx-sep" />

      <button
        type="button"
        role="menuitem"
        className="ctx-item"
        disabled={!canUnpin}
        title={canUnpin ? undefined : "Home can't be unpinned"}
        onClick={() => {
          if (!canUnpin) {
            return;
          }
          dispatch("unpin");
        }}
      >
        <span className="ci-ico">
          <PinOff size={15} />
        </span>
        <span className="ci-label">Unpin</span>
      </button>
    </div>,
    document.body,
  );
}
