use std::path::{Path, PathBuf};

#[derive(serde::Serialize)]
struct Entry {
    name: String,
    path: String,
    is_dir: bool,
    kind: String,
}

#[derive(serde::Serialize)]
struct SearchMatch {
    file_name: String,
    path: String,
    line_number: usize,
    line_text: String,
    match_start: usize,
    match_end: usize,
}

#[derive(serde::Serialize)]
struct SearchResponse {
    matches: Vec<SearchMatch>,
    truncated: bool,
}

const MAX_SEARCH_MATCHES: usize = 500;

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
fn search_files(root: String, query: String) -> Result<SearchResponse, String> {
    let root = PathBuf::from(root);
    if !root.is_dir() {
        return Err(format!("\"{}\" is not a folder", root.display()));
    }

    let query = query.trim();
    if query.is_empty() {
        return Ok(SearchResponse {
            matches: Vec::new(),
            truncated: false,
        });
    }

    let mut response = SearchResponse {
        matches: Vec::new(),
        truncated: false,
    };
    search_folder(&root, &query.to_ascii_lowercase(), query.len(), &mut response)?;
    Ok(response)
}

fn search_folder(
    folder: &Path,
    needle: &str,
    needle_len: usize,
    response: &mut SearchResponse,
) -> Result<(), String> {
    if response.truncated {
        return Ok(());
    }

    let mut entries = Vec::new();
    for item in std::fs::read_dir(folder).map_err(|error| error.to_string())? {
        let Ok(item) = item else {
            continue;
        };
        let path = item.path();
        let Ok(metadata) = item.metadata() else {
            continue;
        };
        let is_dir = metadata.is_dir();
        if entry_kind(&path, is_dir).is_some() {
            entries.push((path, is_dir));
        }
    }

    entries.sort_by(|(left_path, left_dir), (right_path, right_dir)| {
        right_dir.cmp(left_dir).then_with(|| {
            display_name(left_path)
                .to_lowercase()
                .cmp(&display_name(right_path).to_lowercase())
        })
    });

    for (path, is_dir) in entries {
        if response.truncated {
            break;
        }

        if is_dir {
            // Permission errors inside the tree should not discard results from
            // readable folders that were already searched.
            let _ = search_folder(&path, needle, needle_len, response);
            continue;
        }

        search_file(&path, needle, needle_len, response);
    }

    Ok(())
}

fn search_file(path: &Path, needle: &str, needle_len: usize, response: &mut SearchResponse) {
    let Ok(content) = std::fs::read_to_string(path) else {
        return;
    };

    for (line_index, line) in content.lines().enumerate() {
        if response.matches.len() >= MAX_SEARCH_MATCHES {
            response.truncated = true;
            return;
        }

        let haystack = line.to_ascii_lowercase();
        let Some(match_start) = haystack.find(needle) else {
            continue;
        };

        response.matches.push(SearchMatch {
            file_name: display_name(path),
            path: path.display().to_string(),
            line_number: line_index + 1,
            line_text: line.to_string(),
            match_start,
            match_end: match_start + needle_len,
        });
    }
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(path, content).map_err(|error| error.to_string())
}

/// Create an empty file. Fails if a file or folder already exists at `path`
/// so the UI can surface a clear "name already exists" message.
#[tauri::command]
fn create_file(path: String) -> Result<(), String> {
    let target = Path::new(&path);
    if target.exists() {
        return Err(format!("\"{}\" already exists", display_name(target)));
    }

    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    std::fs::write(target, "").map_err(|error| error.to_string())
}

/// Create a new directory. Fails if anything already exists at `path`.
#[tauri::command]
fn create_folder(path: String) -> Result<(), String> {
    let target = Path::new(&path);
    if target.exists() {
        return Err(format!("\"{}\" already exists", display_name(target)));
    }

    std::fs::create_dir_all(target).map_err(|error| error.to_string())
}

/// Rename/move a path. Refuses to clobber an existing destination.
#[tauri::command]
fn rename_path(from: String, to: String) -> Result<(), String> {
    let destination = Path::new(&to);

    // Allow case-only renames on case-insensitive filesystems, but otherwise
    // refuse to overwrite an existing entry.
    let same_target = Path::new(&from) == destination;
    if !same_target && destination.exists() {
        return Err(format!("\"{}\" already exists", display_name(destination)));
    }

    std::fs::rename(&from, &to).map_err(|error| error.to_string())
}

/// Move a path to the OS recycle bin / trash (recoverable).
#[tauri::command]
fn delete_path(path: String) -> Result<(), String> {
    trash::delete(&path).map_err(|error| error.to_string())
}

/// Open the system file manager with the given path selected.
#[tauri::command]
fn reveal_in_explorer(path: String) -> Result<(), String> {
    use std::process::Command;

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg("/select,")
            .arg(&path)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        // Reveal the containing folder; most Linux file managers lack a
        // portable "select file" flag.
        let target = Path::new(&path);
        let folder = if target.is_dir() {
            target.to_path_buf()
        } else {
            target.parent().map(Path::to_path_buf).unwrap_or(target.to_path_buf())
        };
        Command::new("xdg-open")
            .arg(folder)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }
}

/// Resolve a link target (from a rendered markdown link) against the directory
/// of the file it appears in. Relative targets are joined onto that directory;
/// absolute targets are used as-is. The result is canonicalized to an absolute
/// path and only returned if it exists, so the UI can guard against dead links.
#[tauri::command]
fn resolve_link_path(base_file: String, target: String) -> Result<String, String> {
    let base_dir = Path::new(&base_file)
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));

    let raw = Path::new(&target);
    let joined = if raw.is_absolute() {
        raw.to_path_buf()
    } else {
        base_dir.join(raw)
    };

    let canonical = std::fs::canonicalize(&joined)
        .map_err(|error| format!("\"{}\": {}", joined.display(), error))?;

    // Strip Windows' verbatim (\\?\) prefix so the path matches what the rest of
    // the app stores and compares against.
    let resolved = canonical.display().to_string();
    let resolved = resolved
        .strip_prefix(r"\\?\")
        .map(String::from)
        .unwrap_or(resolved);

    Ok(resolved)
}

fn display_name(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(String::from)
        .unwrap_or_else(|| path.display().to_string())
}

/// Build a Saved-location Entry for an existing folder path (used when pinning a
/// folder picked from the native dialog).
#[tauri::command]
fn folder_entry(path: String) -> Result<Entry, String> {
    let target = Path::new(&path);
    if !target.is_dir() {
        return Err(format!("\"{}\" is not a folder", path));
    }

    Ok(Entry {
        name: display_name(target),
        path: target.display().to_string(),
        is_dir: true,
        kind: "folder".to_string(),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            default_locations,
            read_dir,
            read_file,
            search_files,
            write_file,
            create_file,
            create_folder,
            rename_path,
            delete_path,
            reveal_in_explorer,
            folder_entry,
            resolve_link_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
