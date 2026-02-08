mod workspace_sync;

use workspace_sync::{
    // Basic sync commands
    check_sync_status, get_api_key, get_sync_config, pull_workspace, push_workspace,
    select_sync_folder, set_sync_config, store_api_key,
    // Delta sync commands
    clear_agent_files, get_cached_signatures, get_local_signatures, pull_workspace_delta,
    push_workspace_delta,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Basic sync commands
            select_sync_folder,
            get_sync_config,
            set_sync_config,
            check_sync_status,
            pull_workspace,
            push_workspace,
            store_api_key,
            get_api_key,
            // Delta sync commands
            get_local_signatures,
            get_cached_signatures,
            push_workspace_delta,
            pull_workspace_delta,
            clear_agent_files,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
