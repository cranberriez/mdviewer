use std::path::{Path, PathBuf};

#[derive(serde::Serialize)]
struct Entry {
    name: String,
    path: String,
    is_dir: bool,
    kind: String,
}

fn entry_kind(path: &Path, is_dir: bool) -> Option<&'static str> {
    if is_dir {
        return Some("folder");
    }

    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
    {
        Some(extension) if extension == "md" || extension == "markdown" => Some("md"),
        Some(extension) if extension == "txt" => Some("text"),
        _ => None,
    }
}

fn path_to_entry(path: PathBuf) -> Option<Entry> {
    let metadata = std::fs::metadata(&path).ok()?;
    let is_dir = metadata.is_dir();
    let kind = entry_kind(&path, is_dir)?;
    let name = path
        .file_name()
        .and_then(|file_name| file_name.to_str())
        .map(String::from)
        .unwrap_or_else(|| path.display().to_string());

    Some(Entry {
        name,
        path: path.display().to_string(),
        is_dir,
        kind: kind.to_string(),
    })
}

fn user_profile() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(PathBuf::from))
}

#[tauri::command]
fn default_locations() -> Vec<Entry> {
    let mut locations = Vec::new();

    if let Some(home) = user_profile() {
        locations.push(Entry {
            name: "Home".to_string(),
            path: home.display().to_string(),
            is_dir: true,
            kind: "folder".to_string(),
        });

        for folder_name in ["Documents", "Desktop"] {
            let folder = home.join(folder_name);
            if folder.is_dir() {
                locations.push(Entry {
                    name: folder_name.to_string(),
                    path: folder.display().to_string(),
                    is_dir: true,
                    kind: "folder".to_string(),
                });
            }
        }
    }

    locations
}

#[tauri::command]
fn read_dir(path: String) -> Result<Vec<Entry>, String> {
    let mut entries = Vec::new();

    for item in std::fs::read_dir(path).map_err(|error| error.to_string())? {
        let item = item.map_err(|error| error.to_string())?;
        if let Some(entry) = path_to_entry(item.path()) {
            entries.push(entry);
        }
    }

    entries.sort_by(|left, right| {
        right
            .is_dir
            .cmp(&left.is_dir)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });

    Ok(entries)
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(path, content).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            default_locations,
            read_dir,
            read_file,
            write_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
