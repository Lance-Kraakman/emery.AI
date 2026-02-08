mod workspace_sync;

use workspace_sync::{
    // Configuration commands
    get_api_key, get_sync_config, select_sync_folder, set_sync_config, store_api_key,
    // SFTP connection commands
    sftp_connect, sftp_disconnect, sftp_is_connected,
    // Workspace lock commands
    check_workspace_lock,
    // Sync status commands
    check_sync_status,
    // Sync commands (SFTP + rsync)
    pull_workspace, push_workspace, sync_pending_changes,
    // Filesystem watcher commands
    get_watched_path, is_watching, start_watching, stop_watching,
    // Deprecated commands (kept for backwards compatibility)
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
            // Configuration commands
            select_sync_folder,
            get_sync_config,
            set_sync_config,
            store_api_key,
            get_api_key,
            // SFTP connection commands
            sftp_connect,
            sftp_disconnect,
            sftp_is_connected,
            // Workspace lock commands
            check_workspace_lock,
            // Sync status commands
            check_sync_status,
            // Sync commands (SFTP + rsync)
            push_workspace,
            pull_workspace,
            sync_pending_changes,
            // Filesystem watcher commands
            start_watching,
            stop_watching,
            is_watching,
            get_watched_path,
            // Deprecated commands (backwards compatibility)
            get_local_signatures,
            get_cached_signatures,
            push_workspace_delta,
            pull_workspace_delta,
            clear_agent_files,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
