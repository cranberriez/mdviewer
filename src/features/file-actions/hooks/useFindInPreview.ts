import { useCallback, useEffect, useRef, useState } from "react";

const markClass =
  "rounded-[3px] bg-[#4a4a2e] px-0.5 text-[#f2f2dc] data-[current=true]:bg-[#6b6b3a]";

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

export function useFindInPreview(
  targetRef: React.RefObject<HTMLElement | null>,
  contentKey: string,
) {
  const matchesRef = useRef<HTMLElement[]>([]);
  const [current, setCurrent] = useState(-1);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [total, setTotal] = useState(0);

  const close = useCallback(() => {
    const target = targetRef.current;
    if (target) {
      clearMarks(target);
    }

    matchesRef.current = [];
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

  const goTo = useCallback((direction: 1 | -1) => {
    const matches = matchesRef.current;
    if (!matches.length) {
      return;
    }

    setCurrent((currentIndex) => {
      const nextIndex =
        currentIndex < 0
          ? 0
          : (currentIndex + direction + matches.length) % matches.length;

      focusMatch(matches, nextIndex);
      return nextIndex;
    });
  }, []);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) {
      matchesRef.current = [];
      setCurrent(-1);
      setTotal(0);
      return;
    }

    if (!open) {
      clearMarks(target);
      matchesRef.current = [];
      setCurrent(-1);
      setTotal(0);
      return;
    }

    const matches = buildMatches(target, query);
    matchesRef.current = matches;
    setTotal(matches.length);

    if (!matches.length) {
      setCurrent(-1);
      return;
    }

    focusMatch(matches, 0);
    setCurrent(0);
  }, [contentKey, open, query, targetRef]);

  return {
    close,
    current,
    goToNext: () => goTo(1),
    goToPrevious: () => goTo(-1),
    open,
    query,
    setOpen,
    setQuery,
    toggle,
    total,
  };
}
