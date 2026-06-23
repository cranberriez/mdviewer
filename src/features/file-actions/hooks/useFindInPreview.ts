import { useCallback, useLayoutEffect, useRef, useState } from "react";

// current match is distinguished purely by a brighter background.
const markClass = "rounded-[3px] bg-[#4a4a2e] text-[#f2f2dc] data-[current=true]:bg-[#6b6b3a]";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clearMarks(root: HTMLElement) {
  root.querySelectorAll("mark[data-file-find]").forEach((mark) => {
    mark.replaceWith(document.createTextNode(mark.textContent ?? ""));
  });
  root.normalize();
}

function buildMatches(root: HTMLElement, query: string) {
  clearMarks(root);

  // Match the raw query (only the surrounding whitespace the user can't see is
  // ignored). A single character is a valid search, so there is no minimum
  // length: highlighting happens for any non-empty input.
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const matcher = new RegExp(escapeRegExp(trimmedQuery), "gi");
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  const matches: HTMLElement[] = [];

  for (const node of textNodes) {
    const text = node.nodeValue ?? "";
    matcher.lastIndex = 0;

    if (!matcher.test(text)) {
      continue;
    }

    matcher.lastIndex = 0;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = matcher.exec(text)) !== null) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));

      const mark = document.createElement("mark");
      mark.dataset.fileFind = "true";
      mark.className = markClass;
      mark.textContent = match[0];
      fragment.appendChild(mark);
      matches.push(mark);

      lastIndex = match.index + match[0].length;

      // Guard against zero-length matches looping forever.
      if (match.index === matcher.lastIndex) {
        matcher.lastIndex += 1;
      }
    }

    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    node.replaceWith(fragment);
  }

  return matches;
}

function focusMatch(matches: HTMLElement[], index: number) {
  matches.forEach((match, matchIndex) => {
    match.dataset.current = String(matchIndex === index);
  });

  matches[index]?.scrollIntoView({ block: "center", behavior: "smooth" });
}

export function useFindInPreview(targetRef: React.RefObject<HTMLElement | null>, contentKey: string) {
  const matchesRef = useRef<HTMLElement[]>([]);
  // Mirror of `current` in a ref so navigation can read/advance the active
  // index synchronously without depending on React state timing.
  const currentRef = useRef(-1);
  const [current, setCurrent] = useState(-1);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [total, setTotal] = useState(0);

  const setActive = useCallback((index: number) => {
    currentRef.current = index;
    setCurrent(index);
    if (index >= 0) {
      focusMatch(matchesRef.current, index);
    }
  }, []);

  const close = useCallback(() => {
    const target = targetRef.current;
    if (target) {
      clearMarks(target);
    }

    matchesRef.current = [];
    currentRef.current = -1;
    setCurrent(-1);
    setOpen(false);
    setQuery("");
    setTotal(0);
  }, [targetRef]);

  const toggle = useCallback(() => {
    if (open) {
      close();
      return;
    }

    setOpen(true);
  }, [close, open]);

  // Move to the next/previous match. Reads the live match list and active index
  // from refs, so it works regardless of re-renders and never rebuilds or
  // clears the existing highlights.
  const goTo = useCallback(
    (direction: 1 | -1) => {
      const matches = matchesRef.current;
      if (!matches.length) {
        return;
      }

      const currentIndex = currentRef.current;
      const nextIndex = currentIndex < 0 ? 0 : (currentIndex + direction + matches.length) % matches.length;

      setActive(nextIndex);
    },
    [setActive],
  );

  // Inject highlights with a layout effect so it runs *after* React has
  // committed the rendered content to the DOM (and after the preview node is
  // swapped when the pane mounts), but before paint. Using a plain effect here
  // races React's commit: marks could be injected into a node React then
  // replaces, leaving a non-zero match count but no visible highlights.
  useLayoutEffect(() => {
    const target = targetRef.current;
    if (!target) {
      matchesRef.current = [];
      currentRef.current = -1;
      setCurrent(-1);
      setTotal(0);
      return;
    }

    if (!open) {
      clearMarks(target);
      matchesRef.current = [];
      currentRef.current = -1;
      setCurrent(-1);
      setTotal(0);
      return;
    }

    const matches = buildMatches(target, query);
    matchesRef.current = matches;
    setTotal(matches.length);

    if (!matches.length) {
      currentRef.current = -1;
      setCurrent(-1);
      return;
    }

    // Keep the active match in range as the result set changes between keystrokes.
    const nextIndex = currentRef.current >= 0 && currentRef.current < matches.length ? currentRef.current : 0;
    setActive(nextIndex);

    // Clean up our DOM mutations if this effect re-runs or the pane unmounts,
    // so stale marks never linger in a node React is about to reuse.
    return () => clearMarks(target);
  }, [contentKey, open, query, setActive, targetRef]);

  return {
    close,
    current,
    goToNext: useCallback(() => goTo(1), [goTo]),
    goToPrevious: useCallback(() => goTo(-1), [goTo]),
    open,
    query,
    setOpen,
    setQuery,
    toggle,
    total,
  };
}
