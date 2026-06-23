import { Home } from "lucide-react";
import type { Entry } from "../../../shared/types/files";
import { EmptySidebar } from "./EmptySidebar";
import { TreeNode } from "./TreeNode";

interface SidebarProps {
  width: number;
  locations: Entry[];
  activeRoot: Entry | null;
  rootChildren?: Entry[];
  expanded: Set<string>;
  childrenCache: Record<string, Entry[]>;
  loadingPaths: Set<string>;
  activeFilePath?: string;
  onSelectLocation: (location: Entry) => Promise<void>;
  onToggleFolder: (entry: Entry) => Promise<void>;
  onSelectFile: (entry: Entry) => Promise<void>;
}

export function Sidebar({
  width,
  locations,
  activeRoot,
  rootChildren,
  expanded,
  childrenCache,
  loadingPaths,
  activeFilePath,
  onSelectLocation,
  onToggleFolder,
  onSelectFile,
}: SidebarProps) {
  return (
    <aside
      className="sidebar"
      style={{ width, flexBasis: width }}
      aria-label="File explorer"
    >
      <section className="sidebar-section">
        <div className="section-label">Saved</div>
        <div className="saved-list">
          {locations.map((location) => (
            <button
              type="button"
              className={`saved-row ${
                activeRoot?.path === location.path ? "active" : ""
              }`}
              key={location.path}
              onClick={() => void onSelectLocation(location)}
            >
              <Home size={15} />
              <span>{location.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="sidebar-section explorer-section">
        <div className="explorer-heading">
          <div>
            <div className="section-label">Explorer</div>
            <strong>{activeRoot?.name ?? "No location"}</strong>
          </div>
          {activeRoot ? (
            <span className="entry-count">
              {rootChildren ? rootChildren.length : "..."}
            </span>
          ) : null}
        </div>

        <div className="tree" role="tree">
          {!activeRoot ? (
            <EmptySidebar message="No saved locations found." />
          ) : rootChildren ? (
            rootChildren.length > 0 ? (
              rootChildren.map((entry) => (
                <TreeNode
                  key={entry.path}
                  entry={entry}
                  depth={0}
                  expanded={expanded}
                  childrenCache={childrenCache}
                  loadingPaths={loadingPaths}
                  activeFilePath={activeFilePath}
                  onToggleFolder={onToggleFolder}
                  onSelectFile={onSelectFile}
                />
              ))
            ) : (
              <EmptySidebar message="No markdown or text files here." />
            )
          ) : (
            <EmptySidebar message="Loading folder..." />
          )}
        </div>
      </section>
    </aside>
  );
}
