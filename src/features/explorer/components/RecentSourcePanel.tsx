import { useMemo } from "react";
import { ChevronDown, ChevronUp, FileText, FolderOpen } from "lucide-react";
import type { NavigationHistoryItem } from "../../../shared/state/persistence";

const COLLAPSED_VISIBLE_COUNT = 5;

function historyKey(item: NavigationHistoryItem, index: number) {
  if (item.kind === "root") {
    return `root:${item.root.path}:${index}`;
  }

  return `file:${item.file.path}:${index}`;
}

function historyTitle(item: NavigationHistoryItem) {
  if (item.kind === "root") {
    return item.root.path;
  }

  return item.root ? `${item.root.path}\n${item.file.path}` : item.file.path;
}

interface RecentSourcePanelProps {
  items: NavigationHistoryItem[];
  currentIndex: number;
  expanded: boolean;
  onOpenHistoryItem: (index: number) => void;
  onExpandedChange: (expanded: boolean) => void;
}

export function RecentSourcePanel({
  items,
  currentIndex,
  expanded,
  onOpenHistoryItem,
  onExpandedChange,
}: RecentSourcePanelProps) {
  const newestFirst = useMemo(
    () => items.map((item, index) => ({ item, index })).reverse(),
    [items],
  );
  const visibleItems = expanded ? newestFirst : newestFirst.slice(0, COLLAPSED_VISIBLE_COUNT);
  const hiddenCount = Math.max(0, newestFirst.length - COLLAPSED_VISIBLE_COUNT);

  if (items.length === 0) {
    return (
      <div className="recent-source-empty">
        Files and roots you open will show up here.
      </div>
    );
  }

  return (
    <div className="recent-source">
      <div className="recent-source-list">
        {visibleItems.map(({ item, index }) => {
          const isRoot = item.kind === "root";
          const label = isRoot ? item.root.name : item.file.name;
          const sublabel = isRoot ? "Root folder" : (item.root?.name ?? "Single file");
          return (
            <button
              key={historyKey(item, index)}
              type="button"
              className={`recent-source-row ${index === currentIndex ? "active" : ""}`}
              title={historyTitle(item)}
              aria-current={index === currentIndex ? "page" : undefined}
              onClick={() => onOpenHistoryItem(index)}
            >
              <span className="recent-source-ico">
                {isRoot ? <FolderOpen size={15} /> : <FileText size={15} />}
              </span>
              <span className="recent-source-text">
                <span className="recent-source-name">{label}</span>
                <span className="recent-source-sub">{sublabel}</span>
              </span>
            </button>
          );
        })}
      </div>

      {hiddenCount > 0 ? (
        <button
          type="button"
          className="recent-source-toggle"
          onClick={() => onExpandedChange(!expanded)}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? "Show less" : `Show ${hiddenCount} more`}
        </button>
      ) : null}
    </div>
  );
}
