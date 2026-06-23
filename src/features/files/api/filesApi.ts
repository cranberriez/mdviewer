import { invoke } from "@tauri-apps/api/core";
import type { Entry } from "../../../shared/types/files";

export function defaultLocations() {
  return invoke<Entry[]>("default_locations");
}

export function readFolder(path: string) {
  return invoke<Entry[]>("read_dir", { path });
}

export function readFile(path: string) {
  return invoke<string>("read_file", { path });
}

export function writeFile(path: string, content: string) {
  return invoke<void>("write_file", { path, content });
}

export function createFile(path: string) {
  return invoke<void>("create_file", { path });
}

export function createFolder(path: string) {
  return invoke<void>("create_folder", { path });
}

export function renamePath(from: string, to: string) {
  return invoke<void>("rename_path", { from, to });
}

export function deletePath(path: string) {
  return invoke<void>("delete_path", { path });
}

export function revealInExplorer(path: string) {
  return invoke<void>("reveal_in_explorer", { path });
}
