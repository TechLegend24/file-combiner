use std::fs::File;
use std::io::{BufRead, BufReader, Write};
use std::collections::HashSet;

#[tauri::command]
fn process_csv_files(file_a: String, file_b: String) -> Result<Vec<String>, String> {
    let mut unique_rows = Vec::new();
    let mut seen_entries = HashSet::new();
    let mut header: Option<String> = None;

    let mut read_sheet = |path: &str| -> Result<(), String> {
        let file = File::open(path).map_err(|e| e.to_string())?;
        let reader = BufReader::new(file);
        let mut is_first_line = true;

        for line_result in reader.lines() {
            let line = line_result.map_err(|e| e.to_string())?;
            let trimmed = line.trim().to_string();
            if trimmed.is_empty() { continue; }

            if is_first_line {
                if header.is_none() {
                    header = Some(trimmed.clone());
                    unique_rows.push(trimmed);
                }
                is_first_line = false;
                continue;
            }

            if !seen_entries.contains(&trimmed) {
                seen_entries.insert(trimmed.clone());
                unique_rows.push(trimmed);
            }
        }
        Ok(())
    };

    read_sheet(&file_a)?;
    read_sheet(&file_b)?;
    Ok(unique_rows)
}

// NEW SAVE COMMAND: Writes data array items back to the disk
#[tauri::command]
fn save_csv_file(path: String, content: Vec<String>) -> Result<(), String> {
    let mut file = File::create(path).map_err(|e| e.to_string())?;
    for line in content {
        writeln!(file, "{}", line).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![process_csv_files, save_csv_file]) // <-- Make sure save_csv_file is registered here!
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
