import type { ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, PanelLeft, Square, X } from "lucide-react";

interface TitleBarProps {
  explorerHidden: boolean;
  fileActionsSlot?: ReactNode;
  rootName?: string;
  scopeName?: string | null;
  title: string;
  onToggleExplorer: () => void;
}

export function TitleBar({
  explorerHidden,
  fileActionsSlot,
  rootName,
  scopeName,
  title,
  onToggleExplorer,
}: TitleBarProps) {
  return (
    <header className="titlebar" data-tauri-drag-region>
      <button
        type="button"
        className={`titlebar-button titlebar-explorer ${
          explorerHidden ? "bright" : ""
        }`}
        aria-label="Toggle explorer"
        title="Toggle explorer"
        onClick={onToggleExplorer}
      >
        <PanelLeft size={15} />
      </button>

      <div className="titlebar-crumb" data-tauri-drag-region>
        <span data-tauri-drag-region>{rootName ?? "Home"}</span>
        {scopeName ? (
          <>
            <span className="crumb-separator" data-tauri-drag-region>
              /
            </span>
            <span data-tauri-drag-region>{scopeName}</span>
          </>
        ) : null}
        <span className="crumb-separator" data-tauri-drag-region>
          /
        </span>
        <span className="crumb-name" data-tauri-drag-region>
          {title}
        </span>
      </div>

      <div className="titlebar-drag-space" data-tauri-drag-region />

      {fileActionsSlot ? (
        <div className="titlebar-actions">{fileActionsSlot}</div>
      ) : null}

      <div className="window-controls">
        <button
          type="button"
          className="window-button"
          aria-label="Minimize"
          title="Minimize"
          onClick={() => void getCurrentWindow().minimize()}
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          className="window-button"
          aria-label="Maximize"
          title="Maximize"
          onClick={() => void getCurrentWindow().toggleMaximize()}
        >
          <Square size={12} />
        </button>
        <button
          type="button"
          className="window-button close"
          aria-label="Close"
          title="Close"
          onClick={() => void getCurrentWindow().close()}
        >
          <X size={14} />
        </button>
      </div>
    </header>
  );
}
