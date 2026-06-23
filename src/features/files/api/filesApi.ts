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
