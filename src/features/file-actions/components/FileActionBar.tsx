import type { ReactNode } from "react";

interface FileActionBarProps {
  children: ReactNode;
}

export function FileActionBar({ children }: FileActionBarProps) {
  return (
    <div className="file-action-row">
      {children}
    </div>
  );
}
