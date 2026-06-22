use std::fs::File;
use std::io::{BufRead, BufReader, Write};
use std::collections::HashSet;
use tauri::Manager;

#[tauri::command]
fn sync_with_device_csv(app_handle: tauri::AppHandle, device_lines: Vec<String>) -> Result<Vec<String>, String> {
    // 1. Establish persistent local data paths
    let mut master_path = app_handle.path().app_local_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&master_path).map_err(|e| e.to_string())?;
    master_path.push("master.csv");

    let mut unique_rows = Vec::new();
    let mut seen_entries = HashSet::new();
    let mut header: Option<String> = None;

    // 2. Load existing master values from hard drive if it already exists
    if master_path.exists() {
        let file = File::open(&master_path).map_err(|e| e.to_string())?;
        let reader = BufReader::new(file);
        let mut is_first = true;

        for line_res in reader.lines() {
            let line = line_res.map_err(|e| e.to_string())?;
            let trimmed = line.trim().to_string();
            if trimmed.is_empty() { continue; }

            if is_first {
                header = Some(trimmed.clone());
                unique_rows.push(trimmed);
                is_first = false;
                continue;
            }

            if !seen_entries.contains(&trimmed) {
                seen_entries.insert(trimmed.clone());
                unique_rows.push(trimmed);
            }
        }
    }

    // 3. Incorporate the incoming rows we pulled from the hardware
    let mut is_first_incoming = true;
    for line in device_lines {
        let trimmed = line.trim().to_string();
        if trimmed.is_empty() { continue; }

        if is_first_incoming {
            // Register column header line if master.csv didn't exist yet
            if header.is_none() {
                header = Some(trimmed.clone());
                unique_rows.push(trimmed);
            }
            is_first_incoming = false;
            continue;
        }

        // Seamless deduplication step
        if !seen_entries.contains(&trimmed) {
            seen_entries.insert(trimmed.clone());
            unique_rows.push(trimmed);
        }
    }

    // 4. Overwrite Master storage database with clean consolidated arrays
    let mut file = File::create(&master_path).map_err(|e| e.to_string())?;
    for line in &unique_rows {
        writeln!(file, "{}", line).map_err(|e| e.to_string())?;
    }

    println!("Master database file safely committed at: {:?}", master_path);
    Ok(unique_rows)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![sync_with_device_csv]) // Register our new extraction sync function
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
