interface EmptySidebarProps {
  message: string;
}

export function EmptySidebar({ message }: EmptySidebarProps) {
  return <div className="sidebar-empty">{message}</div>;
}
