import { useEffect, useState, type ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, PanelLeft, Square, X } from "lucide-react";

interface TitleBarProps {
  explorerHidden: boolean;
  fileActionsSlot?: ReactNode;
  rootName?: string;
  scopeName?: string | null;
  title: string;
  /** Hide the explorer toggle (e.g. on the Home/onboarding overlay). */
  hideExplorerToggle?: boolean;
  onToggleExplorer: () => void;
}

export function TitleBar({
  explorerHidden,
  fileActionsSlot,
  rootName,
  scopeName,
  title,
  hideExplorerToggle = false,
  onToggleExplorer,
}: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    let cancelled = false;
    let unlistenResize: (() => void) | undefined;

    async function setup() {
      try {
        const maximized = await appWindow.isMaximized();
        if (!cancelled) setIsMaximized(maximized);

        const unlisten = await appWindow.onResized(async () => {
          const v = await appWindow.isMaximized();
          if (!cancelled) setIsMaximized(v);
        });

        if (cancelled) {
          unlisten();
        } else {
          unlistenResize = unlisten;
        }
      } catch {
        // Best effort — window APIs may not be available outside Tauri.
      }
    }

    void setup();

    return () => {
      cancelled = true;
      unlistenResize?.();
    };
  }, []);

  // Avoid a redundant trailing crumb when the title just repeats the root
  // (e.g. "Home / Home" with no file open and no deeper scope).
  const rootLabel = rootName ?? "Home";
  const showTitleSegment = Boolean(scopeName) || title !== rootLabel;

  return (
    <header className="titlebar" data-tauri-drag-region>
      {hideExplorerToggle ? null : (
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
      )}

      <div className="titlebar-crumb" data-tauri-drag-region>
        {hideExplorerToggle ? (
          <span data-tauri-drag-region>{title}</span>
        ) : (
          <>
            <span data-tauri-drag-region>{rootName ?? "Home"}</span>
            {scopeName ? (
              <>
                <span className="crumb-separator" data-tauri-drag-region>
                  /
                </span>
                <span data-tauri-drag-region>{scopeName}</span>
              </>
            ) : null}
            {showTitleSegment ? (
              <>
                <span className="crumb-separator" data-tauri-drag-region>
                  /
                </span>
                <span className="crumb-name" data-tauri-drag-region>
                  {title}
                </span>
              </>
            ) : null}
          </>
        )}
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
          aria-label={isMaximized ? "Restore" : "Maximize"}
          title={isMaximized ? "Restore" : "Maximize"}
          onClick={() => void getCurrentWindow().toggleMaximize()}
        >
          {isMaximized ? (
            /* Restore icon: two overlapping squares */
            <svg
              width="13"
              height="13"
              viewBox="0 0 13 13"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="1" width="9" height="9" rx="1" />
              <path d="M1 4v7a1 1 0 001 1h7" />
            </svg>
          ) : (
            <Square size={12} />
          )}
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
