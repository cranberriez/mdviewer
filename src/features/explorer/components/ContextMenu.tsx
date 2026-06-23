import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Copy,
  CornerUpLeft,
  FilePlus,
  FolderPlus,
  Link2,
  Pencil,
  Scissors,
  SquareArrowOutUpRight,
  TerminalSquare,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ContextMenuTargetKind = "folder" | "file";

export interface ContextMenuTarget {
  kind: ContextMenuTargetKind;
  path: string;
  name: string;
  /** Anchor coordinates (viewport pixels) where the menu should open. */
  x: number;
  y: number;
}

export type ContextMenuAction =
  | "new-file"
  | "new-folder"
  | "open"
  | "reveal"
  | "copy-path"
  | "rename"
  | "delete";

interface MenuItem {
  id: ContextMenuAction;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
}

interface MenuSeparator {
  separator: true;
}

type MenuEntry = MenuItem | MenuSeparator;

function isSeparator(entry: MenuEntry): entry is MenuSeparator {
  return "separator" in entry;
}

// Items that are part of the mockup but not yet wired up. Shown disabled so the
// remaining work is visible in the UI.
const PENDING_CUT: MenuItem = {
  id: "copy-path",
  label: "Cut",
  icon: Scissors,
  shortcut: "Ctrl+X",
  disabled: true,
};
const PENDING_COPY: MenuItem = {
  id: "copy-path",
  label: "Copy",
  icon: Copy,
  shortcut: "Ctrl+C",
  disabled: true,
};

const COMMON_TAIL: MenuEntry[] = [
  PENDING_CUT,
  PENDING_COPY,
  { separator: true },
  { id: "copy-path", label: "Copy Path", icon: Link2, shortcut: "Shift+Alt+C" },
  { separator: true },
  { id: "rename", label: "Rename…", icon: Pencil, shortcut: "F2" },
  { id: "delete", label: "Delete", icon: Trash2, shortcut: "Del", danger: true },
];

function entriesFor(kind: ContextMenuTargetKind): MenuEntry[] {
  if (kind === "folder") {
    return [
      { id: "new-file", label: "New File…", icon: FilePlus },
      { id: "new-folder", label: "New Folder…", icon: FolderPlus },
      { separator: true },
      { id: "reveal", label: "Reveal in File Explorer", icon: CornerUpLeft, shortcut: "Shift+Alt+R" },
      {
        id: "open",
        label: "Open in Terminal",
        icon: TerminalSquare,
        disabled: true,
      },
      { separator: true },
      ...COMMON_TAIL,
    ];
  }

  return [
    { id: "open", label: "Open", icon: SquareArrowOutUpRight, shortcut: "Enter" },
    { separator: true },
    { id: "reveal", label: "Reveal in File Explorer", icon: CornerUpLeft, shortcut: "Shift+Alt+R" },
    { separator: true },
    ...COMMON_TAIL,
  ];
}

interface ContextMenuProps {
  target: ContextMenuTarget;
  onAction: (action: ContextMenuAction, target: ContextMenuTarget) => void;
  onClose: () => void;
}

const VIEWPORT_PADDING = 8;

export function ContextMenu({ target, onAction, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ x: target.x, y: target.y });
  const [ready, setReady] = useState(false);

  // Measure and clamp to the viewport before showing.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) {
      return;
    }

    const { offsetWidth: width, offsetHeight: height } = menu;
    let x = target.x;
    let y = target.y;

    if (x + width + VIEWPORT_PADDING > window.innerWidth) {
      x = Math.max(VIEWPORT_PADDING, window.innerWidth - width - VIEWPORT_PADDING);
    }
    if (y + height + VIEWPORT_PADDING > window.innerHeight) {
      y = Math.max(VIEWPORT_PADDING, window.innerHeight - height - VIEWPORT_PADDING);
    }

    setPosition({ x, y });
    setReady(true);
  }, [target.x, target.y, target.path]);

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

  const entries = entriesFor(target.kind);

  return createPortal(
    <div
      ref={menuRef}
      className={`ctx-menu ${ready ? "show" : ""}`}
      role="menu"
      style={{ left: position.x, top: position.y }}
    >
      {entries.map((entry, index) => {
        if (isSeparator(entry)) {
          // eslint-disable-next-line react/no-array-index-key
          return <div key={`sep-${index}`} className="ctx-sep" />;
        }

        const Icon = entry.icon;
        return (
          <button
            key={`${entry.label}-${index}`}
            type="button"
            role="menuitem"
            className={`ctx-item ${entry.danger ? "danger" : ""}`}
            disabled={entry.disabled}
            onClick={() => {
              if (entry.disabled) {
                return;
              }
              onAction(entry.id, target);
              onClose();
            }}
          >
            <span className="ci-ico">
              <Icon size={15} />
            </span>
            <span className="ci-label">{entry.label}</span>
            {entry.shortcut ? <span className="ci-key">{entry.shortcut}</span> : null}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
