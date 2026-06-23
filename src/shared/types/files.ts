export type EntryKind = "folder" | "md" | "text";

export interface Entry {
  name: string;
  path: string;
  is_dir: boolean;
  kind: EntryKind;
}

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  kind: Exclude<EntryKind, "folder">;
}
