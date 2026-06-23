import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// Find-in-file built on the CSS Custom Highlight API.
//
// Instead of injecting <mark> elements into the rendered preview (which React
// owns via dangerouslySetInnerHTML and will happily wipe on re-render, and
// which shifts layout), we describe matches as Range objects and register them
// with `CSS.highlights`. The browser paints them via the ::highlight()
// pseudo-elements defined in markdown.css. Nothing in the DOM changes, so:
//   - highlights survive React re-renders and arrow/Enter navigation,
//   - text never reflows (no width/letter changes), and
//   - matches of any length (including a single character) are highlighted.

const ALL_HIGHLIGHT = "find-matches";
const CURRENT_HIGHLIGHT = "find-current";

// Feature-detect once. WebView2 / modern Chromium (this app's runtime) supports
// it; older engines simply get no highlights rather than a crash.
function highlightsSupported() {
  return (
    typeof CSS !== "undefined" &&
    typeof Highlight !== "undefined" &&
    Boolean((CSS as unknown as { highlights?: unknown }).highlights)
  );
}

function clearHighlights() {
  if (!highlightsSupported()) {
    return;
  }
  CSS.highlights.delete(ALL_HIGHLIGHT);
  CSS.highlights.delete(CURRENT_HIGHLIGHT);
}

// Collect every text node under `root`, skipping empty ones. Order matches
// document order, which is the order matches will be numbered in.
function collectTextNodes(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.nodeValue && node.nodeValue.length > 0
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  const nodes: Text[] = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
  }
  return nodes;
}

// Build a Range for every (case-insensitive) occurrence of `query`. Matching is
// done per text node; a query that spans element boundaries won't match, which
// is the same behaviour as the browser's native find for inline-styled words.
function buildRanges(root: HTMLElement, query: string): Range[] {
  const needle = query.toLowerCase();
  if (!needle) {
    return [];
  }

  const ranges: Range[] = [];

  for (const node of collectTextNodes(root)) {
    const haystack = (node.nodeValue ?? "").toLowerCase();
    let from = 0;

    for (;;) {
      const index = haystack.indexOf(needle, from);
      if (index === -1) {
        break;
      }

      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + needle.length);
      ranges.push(range);

      from = index + needle.length;
    }
  }

  return ranges;
}

function paint(ranges: Range[], currentIndex: number) {
  if (!highlightsSupported()) {
    return;
  }

  if (!ranges.length) {
    clearHighlights();
    return;
  }

  CSS.highlights.set(ALL_HIGHLIGHT, new Highlight(...ranges));

  const current = ranges[currentIndex];
  if (current) {
    CSS.highlights.set(CURRENT_HIGHLIGHT, new Highlight(current));
  } else {
    CSS.highlights.delete(CURRENT_HIGHLIGHT);
  }
}

// Scroll the active match into view. Ranges have no scrollIntoView, so we use
// the bounding rect relative to the scroll container and nudge it to centre.
function scrollRangeIntoView(range: Range, container: HTMLElement) {
  const rect = range.getBoundingClientRect();
  const box = container.getBoundingClientRect();

  if (rect.height === 0 && rect.width === 0) {
    return;
  }

  const offset = rect.top - box.top - box.height / 2 + rect.height / 2;
  if (Math.abs(offset) < 1) {
    return;
  }

  container.scrollBy({ top: offset, behavior: "smooth" });
}

export function useFindInPreview(
  targetRef: React.RefObject<HTMLElement | null>,
  contentKey: string,
) {
  const rangesRef = useRef<Range[]>([]);
  const currentRef = useRef(-1);
  const queryRef = useRef("");
  const [current, setCurrent] = useState(-1);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [total, setTotal] = useState(0);

  // Re-paint and (optionally) scroll to the active match. Pure DOM/CSS work
  // driven entirely from refs, so it is independent of React render timing.
  const apply = useCallback(
    (index: number, options?: { scroll?: boolean }) => {
      currentRef.current = index;
      setCurrent(index);
      paint(rangesRef.current, index);

      if (options?.scroll) {
        const target = targetRef.current;
        const range = rangesRef.current[index];
        if (target && range) {
          scrollRangeIntoView(range, target);
        }
      }
    },
    [targetRef],
  );

  // Recompute matches for the current query against the live DOM.
  const recompute = useCallback(
    (options?: { resetIndex?: boolean }) => {
      const target = targetRef.current;
      if (!target || !open) {
        rangesRef.current = [];
        clearHighlights();
        setTotal(0);
        currentRef.current = -1;
        setCurrent(-1);
        return;
      }

      const ranges = buildRanges(target, queryRef.current.trim());
      rangesRef.current = ranges;
      setTotal(ranges.length);

      if (!ranges.length) {
        currentRef.current = -1;
        setCurrent(-1);
        clearHighlights();
        return;
      }

      const keepIndex =
        !options?.resetIndex &&
        currentRef.current >= 0 &&
        currentRef.current < ranges.length;
      const nextIndex = keepIndex ? currentRef.current : 0;
      apply(nextIndex, { scroll: options?.resetIndex });
    },
    [apply, open, targetRef],
  );

  const close = useCallback(() => {
    clearHighlights();
    rangesRef.current = [];
    currentRef.current = -1;
    queryRef.current = "";
    setCurrent(-1);
    setOpen(false);
    setQuery("");
    setTotal(0);
  }, []);

  const toggle = useCallback(() => {
    if (open) {
      close();
      return;
    }
    setOpen(true);
  }, [close, open]);

  const updateQuery = useCallback(
    (value: string) => {
      queryRef.current = value;
      setQuery(value);
      // Typing resets to the first match so navigation starts fresh.
      recompute({ resetIndex: true });
    },
    [recompute],
  );

  const goTo = useCallback(
    (direction: 1 | -1) => {
      const ranges = rangesRef.current;
      if (!ranges.length) {
        return;
      }
      const currentIndex = currentRef.current;
      const nextIndex =
        currentIndex < 0
          ? direction === 1
            ? 0
            : ranges.length - 1
          : (currentIndex + direction + ranges.length) % ranges.length;

      apply(nextIndex, { scroll: true });
    },
    [apply],
  );

  // Rebuild whenever the bar opens/closes or the rendered content changes
  // (contentKey). Runs after commit so the DOM it reads is the painted one.
  useLayoutEffect(() => {
    recompute({ resetIndex: true });
    return () => clearHighlights();
    // recompute is stable for a given (open, target); contentKey drives rebuilds.
  }, [contentKey, open, recompute]);

  // If the preview subtree re-renders while find is open (React replacing nodes
  // would invalidate our Ranges), rebuild from the fresh DOM. Cheap because it
  // only observes while the bar is open.
  useEffect(() => {
    const target = targetRef.current;
    if (!open || !target || typeof MutationObserver === "undefined") {
      return;
    }

    const observer = new MutationObserver(() => recompute());
    observer.observe(target, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [open, recompute, targetRef, contentKey]);

  return {
    close,
    current,
    goToNext: useCallback(() => goTo(1), [goTo]),
    goToPrevious: useCallback(() => goTo(-1), [goTo]),
    open,
    query,
    setOpen,
    setQuery: updateQuery,
    toggle,
    total,
  };
}
