import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Folder, History, List, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SourceHeaderActionsVisible } from "../../../shared/state/persistence";
import type { SidebarMode } from "./Sidebar";

export type SourcesHeaderMenuAction =
  | "mode-explorer"
  | "mode-recent"
  | "mode-search"
  | "mode-outline"
  | "toggle-recent"
  | "toggle-search"
  | "toggle-outline";

interface MenuItem {
  id: SourcesHeaderMenuAction;
  label: string;
  icon: LucideIcon;
  checked?: boolean;
  checkable?: boolean;
  disabled?: boolean;
}

interface MenuSeparator {
  separator: true;
}

type MenuEntry = MenuItem | MenuSeparator;

function isSeparator(entry: MenuEntry): entry is MenuSeparator {
  return "separator" in entry;
}

interface SourcesHeaderContextMenuProps {
  x: number;
  y: number;
  mode: SidebarMode;
  showOutlineTab: boolean;
  visibleActions: SourceHeaderActionsVisible;
  onAction: (action: SourcesHeaderMenuAction) => void;
  onClose: () => void;
}

const VIEWPORT_PADDING = 8;

export function SourcesHeaderContextMenu({
  x,
  y,
  mode,
  showOutlineTab,
  visibleActions,
  onAction,
  onClose,
}: SourcesHeaderContextMenuProps) {
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
  }, [x, y]);

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

  const entries: MenuEntry[] = [
    { id: "mode-explorer", label: "Pinned", icon: Folder, checked: mode === "explorer" },
    { id: "mode-recent", label: "Recent", icon: History, checked: mode === "recent" },
    { id: "mode-search", label: "Search", icon: Search, checked: mode === "search" },
    {
      id: "mode-outline",
      label: "Outline",
      icon: List,
      checked: mode === "outline",
      disabled: !showOutlineTab,
    },
    { separator: true },
    {
      id: "toggle-recent",
      label: visibleActions.recent ? "Hide Recent Button" : "Show Recent Button",
      icon: History,
      checked: visibleActions.recent,
      checkable: true,
    },
    {
      id: "toggle-search",
      label: visibleActions.search ? "Hide Search Button" : "Show Search Button",
      icon: Search,
      checked: visibleActions.search,
      checkable: true,
    },
    {
      id: "toggle-outline",
      label: visibleActions.outline ? "Hide Outline Button" : "Show Outline Button",
      icon: List,
      checked: visibleActions.outline,
      checkable: true,
    },
  ];

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
            key={entry.id}
            type="button"
            role="menuitem"
            className="ctx-item"
            disabled={entry.disabled}
            onClick={() => {
              if (entry.disabled) {
                return;
              }
              onAction(entry.id);
              onClose();
            }}
          >
            <span className="ci-ico">
              {entry.checked ? <Check size={15} /> : entry.checkable ? null : <Icon size={15} />}
            </span>
            <span className="ci-label">{entry.label}</span>
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
