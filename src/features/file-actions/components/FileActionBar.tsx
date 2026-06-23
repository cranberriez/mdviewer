import type { ReactNode } from "react";

interface FileActionBarProps {
  children: ReactNode;
}

export function FileActionBar({ children }: FileActionBarProps) {
  return (
    <div className="flex h-[38px] flex-none items-center gap-2 px-2 pl-3">
      {children}
    </div>
  );
}
