import { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { IconActionButton } from "./IconActionButton";

interface FindBarProps {
  current: number;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onQueryChange: (query: string) => void;
  open: boolean;
  query: string;
  total: number;
}

export function FindBar({
  current,
  onClose,
  onNext,
  onPrevious,
  onQueryChange,
  open,
  query,
  total,
}: FindBarProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const countLabel = query.trim()
    ? total > 0
      ? `${current + 1} of ${total}`
      : "No results"
    : "0 results";

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  return (
    <div
      className={`flex items-center gap-2 overflow-hidden border-t px-3 transition-[height,border-color] duration-100 ${
        open ? "h-10 border-border-base" : "h-0 border-transparent"
      }`}
      aria-hidden={!open}
    >
      <div className="flex max-w-[340px] flex-1 items-center gap-2 rounded-ctl border border-border-base bg-bg-window px-2.5 py-[5px]">
        <Search size={14} className="flex-none text-text-muted" />
        <input
          ref={inputRef}
          className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-text-primary outline-none placeholder:text-text-muted"
          placeholder="Find in file..."
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (event.shiftKey) {
                onPrevious();
              } else {
                onNext();
              }
            }

            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
          }}
        />
        <span className="whitespace-nowrap text-xs tabular-nums text-text-muted">
          {countLabel}
        </span>
      </div>

      <IconActionButton tooltip="Previous" onClick={onPrevious}>
        <ChevronUp size={15} />
      </IconActionButton>
      <IconActionButton tooltip="Next" onClick={onNext}>
        <ChevronDown size={15} />
      </IconActionButton>
      <IconActionButton tooltip="Close" onClick={onClose}>
        <X size={15} />
      </IconActionButton>
    </div>
  );
}
