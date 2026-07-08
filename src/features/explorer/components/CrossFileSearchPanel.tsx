import { useEffect, useMemo, useRef } from "react";
import { FileText, LoaderCircle, Search, X } from "lucide-react";
import type { FileSearchMatch } from "../../../shared/types/files";
import { EmptySidebar } from "./EmptySidebar";

interface CrossFileSearchPanelProps {
  root: string | null;
  query: string;
  searchedQuery: string;
  results: FileSearchMatch[];
  loading: boolean;
  error: string | null;
  truncated: boolean;
  showForm: boolean;
  showResults: boolean;
  onQueryChange: (query: string) => void;
  onClear: () => void;
  onSubmit: () => void;
  onOpenResult: (result: FileSearchMatch) => void;
}

function highlightedLine(line: string, query: string) {
  const needle = query.trim().toLowerCase();
  const index = needle ? line.toLowerCase().indexOf(needle) : -1;

  if (index < 0) {
    return line;
  }

  return (
    <>
      {line.slice(0, index)}
      <mark>{line.slice(index, index + needle.length)}</mark>
      {line.slice(index + needle.length)}
    </>
  );
}

export function CrossFileSearchPanel({
  root,
  query,
  searchedQuery,
  results,
  loading,
  error,
  truncated,
  showForm,
  showResults,
  onQueryChange,
  onClear,
  onSubmit,
  onOpenResult,
}: CrossFileSearchPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultLabel = useMemo(() => {
    if (!searchedQuery) {
      return "Search across markdown and text files.";
    }
    if (loading) {
      return "Searching...";
    }

    const count = results.length;
    const noun = count === 1 ? "match" : "matches";
    return truncated ? `First ${count} ${noun}` : `${count} ${noun}`;
  }, [loading, results.length, searchedQuery, truncated]);

  useEffect(() => {
    if (showForm) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [showForm]);

  return (
    <div className={`search-panel ${showResults ? "has-results" : "is-compact"}`}>
      {showForm ? (
        <form
          className="search-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <div className="search-input-shell">
            <Search size={14} aria-hidden="true" />
            <input
              ref={inputRef}
              className="search-input"
              type="text"
              value={query}
              placeholder="Search files"
              disabled={!root}
              onChange={(event) => onQueryChange(event.target.value)}
            />
            {query ? (
              <button
                type="button"
                className="search-clear"
                aria-label="Clear search"
                title="Clear search"
                onClick={onClear}
              >
                <X size={13} />
              </button>
            ) : null}
          </div>
          <button
            type="submit"
            className="search-submit"
            disabled={!root || !query.trim() || loading}
            aria-label="Search files"
            title="Search files"
          >
            {loading ? <LoaderCircle size={14} className="search-spinner" /> : <Search size={14} />}
          </button>
        </form>
      ) : null}

      {showResults ? <div className="search-summary">{resultLabel}</div> : null}

      {showResults && error ? <div className="search-error">{error}</div> : null}

      {!showResults ? null : !root ? (
        <EmptySidebar message="Open a folder to search files." />
      ) : searchedQuery && !loading && results.length === 0 && !error ? (
        <EmptySidebar message="No matches found." />
      ) : results.length > 0 ? (
        <div className="search-results" role="list">
          {results.map((result) => (
            <button
              key={`${result.path}:${result.line_number}:${result.match_start}`}
              type="button"
              className="search-result"
              title={result.path}
              role="listitem"
              onClick={() => onOpenResult(result)}
            >
              <span className="search-result-title">
                <FileText size={14} />
                <span>{result.file_name}</span>
                <span className="search-line-number">:{result.line_number}</span>
              </span>
              <span className="search-result-line">
                {highlightedLine(result.line_text.trim() || " ", searchedQuery)}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
