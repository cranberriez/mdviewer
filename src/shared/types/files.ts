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

export interface FileSearchMatch {
  file_name: string;
  path: string;
  line_number: number;
  line_text: string;
  match_start: number;
  match_end: number;
}

export interface FileSearchResponse {
  matches: FileSearchMatch[];
  truncated: boolean;
}
