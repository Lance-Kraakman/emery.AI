//! Workspace Sync Commands
//!
//! Provides Tauri commands for syncing agent workspaces between
//! local folders and the remote S3-backed storage.

use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use tokio::sync::oneshot;
use tauri_plugin_http::reqwest;
use tauri_plugin_store::StoreExt;
use thiserror::Error;

const STORE_PATH: &str = "workspace-sync.json";
const API_KEY_STORE_KEY: &str = "api_key";

#[derive(Error, Debug)]
pub enum SyncError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("Store error: {0}")]
    Store(String),
    #[error("Dialog cancelled")]
    DialogCancelled,
    #[error("No API key configured")]
    NoApiKey,
    #[error("API error: {0}")]
    Api(String),
}

impl From<SyncError> for String {
    fn from(e: SyncError) -> String {
        e.to_string()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConfig {
    pub folder_path: String,
    pub last_sync: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub local_modified: Option<i64>,
    pub remote_modified: Option<i64>,
    pub has_conflict: bool,
    pub needs_pull: bool,
    pub needs_push: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullResult {
    pub files_extracted: u32,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PushResult {
    pub files_archived: u32,
    pub timestamp: i64,
}

fn get_store_key(agent_id: i64) -> String {
    format!("agent_{}", agent_id)
}

fn get_current_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn get_dir_mtime(path: &Path) -> Option<i64> {
    let mut latest: Option<i64> = None;

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let entry_path = entry.path();

            // Get mtime of this entry
            if let Ok(metadata) = entry.metadata() {
                if let Ok(modified) = metadata.modified() {
                    if let Ok(duration) = modified.duration_since(UNIX_EPOCH) {
                        let mtime = duration.as_secs() as i64;
                        latest = Some(latest.map_or(mtime, |l| l.max(mtime)));
                    }
                }
            }

            // Recurse into subdirectories
            if entry_path.is_dir() {
                if let Some(sub_mtime) = get_dir_mtime(&entry_path) {
                    latest = Some(latest.map_or(sub_mtime, |l| l.max(sub_mtime)));
                }
            }
        }
    }

    latest
}

/// Opens a native folder picker dialog and returns the selected path.
#[tauri::command]
pub async fn select_sync_folder(app: AppHandle) -> Result<String, String> {
    let (tx, rx) = oneshot::channel();

    app.dialog()
        .file()
        .set_title("Select Workspace Sync Folder")
        .pick_folder(move |folder| {
            let _ = tx.send(folder);
        });

    match rx.await {
        Ok(Some(path)) => Ok(path.to_string()),
        Ok(None) => Err(SyncError::DialogCancelled.into()),
        Err(_) => Err("Dialog channel closed".to_string()),
    }
}

/// Gets the sync configuration for an agent.
#[tauri::command]
pub async fn get_sync_config(app: AppHandle, agent_id: i64) -> Result<Option<SyncConfig>, String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| SyncError::Store(e.to_string()))?;

    let key = get_store_key(agent_id);
    let config = store.get(&key).and_then(|v| {
        serde_json::from_value::<SyncConfig>(v.clone()).ok()
    });

    Ok(config)
}

/// Sets the sync configuration for an agent.
#[tauri::command]
pub async fn set_sync_config(
    app: AppHandle,
    agent_id: i64,
    folder_path: String,
) -> Result<(), String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| SyncError::Store(e.to_string()))?;

    let key = get_store_key(agent_id);
    let config = SyncConfig {
        folder_path,
        last_sync: None,
    };

    store.set(
        key,
        serde_json::to_value(&config).map_err(|e| SyncError::Store(e.to_string()))?,
    );
    store.save().map_err(|e| SyncError::Store(e.to_string()))?;

    Ok(())
}

/// Checks the sync status by comparing local and remote modification times.
#[tauri::command]
pub async fn check_sync_status(
    app: AppHandle,
    agent_id: i64,
    api_key: String,
    api_base: String,
) -> Result<SyncStatus, String> {
    // Get local config
    let store = app
        .store(STORE_PATH)
        .map_err(|e| SyncError::Store(e.to_string()))?;

    let key = get_store_key(agent_id);
    let config: Option<SyncConfig> = store.get(&key).and_then(|v| {
        serde_json::from_value(v.clone()).ok()
    });

    let config = config.ok_or_else(|| "No sync config found".to_string())?;
    let local_path = PathBuf::from(&config.folder_path);

    // Get local mtime
    let local_modified = get_dir_mtime(&local_path);

    // Get remote mtime via HEAD request
    let client = reqwest::Client::new();
    let url = format!("{}/api/agents/{}/workspace/download", api_base, agent_id);

    let response = client
        .head(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(SyncError::Http)?;

    let remote_modified = if response.status().is_success() {
        response
            .headers()
            .get("last-modified")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| httpdate::parse_http_date(s).ok())
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
    } else {
        None
    };

    let last_sync = config.last_sync.unwrap_or(0);

    let needs_pull = remote_modified.map_or(false, |r| r > last_sync);
    let needs_push = local_modified.map_or(false, |l| l > last_sync);
    let has_conflict = needs_pull && needs_push;

    Ok(SyncStatus {
        local_modified,
        remote_modified,
        has_conflict,
        needs_pull,
        needs_push,
    })
}

/// Downloads the workspace archive and extracts it to the local folder.
#[tauri::command]
pub async fn pull_workspace(
    app: AppHandle,
    agent_id: i64,
    local_path: String,
    api_key: String,
    api_base: String,
) -> Result<PullResult, String> {
    let local_dir = PathBuf::from(&local_path);

    // Create directory if it doesn't exist
    fs::create_dir_all(&local_dir).map_err(SyncError::Io)?;

    // Download the archive
    let client = reqwest::Client::new();
    let url = format!("{}/api/agents/{}/workspace/download", api_base, agent_id);

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(SyncError::Http)?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(SyncError::Api(format!("Download failed: {} - {}", status, body)).into());
    }

    let bytes = response.bytes().await.map_err(SyncError::Http)?;

    // Clear the target directory (but keep the directory itself)
    if local_dir.exists() {
        for entry in fs::read_dir(&local_dir).map_err(SyncError::Io)? {
            let entry = entry.map_err(SyncError::Io)?;
            let path = entry.path();
            if path.is_dir() {
                fs::remove_dir_all(&path).map_err(SyncError::Io)?;
            } else {
                fs::remove_file(&path).map_err(SyncError::Io)?;
            }
        }
    }

    // Extract the archive
    let decoder = GzDecoder::new(&bytes[..]);
    let mut archive = tar::Archive::new(decoder);

    let mut files_extracted: u32 = 0;
    for entry in archive.entries().map_err(SyncError::Io)? {
        let mut entry = entry.map_err(SyncError::Io)?;
        entry.unpack_in(&local_dir).map_err(SyncError::Io)?;
        files_extracted += 1;
    }

    // Update last sync time
    let timestamp = get_current_timestamp();
    let store = app
        .store(STORE_PATH)
        .map_err(|e| SyncError::Store(e.to_string()))?;

    let key = get_store_key(agent_id);
    let config = SyncConfig {
        folder_path: local_path,
        last_sync: Some(timestamp),
    };
    store.set(
        key,
        serde_json::to_value(&config).map_err(|e| SyncError::Store(e.to_string()))?,
    );
    store.save().map_err(|e| SyncError::Store(e.to_string()))?;

    Ok(PullResult {
        files_extracted,
        timestamp,
    })
}

/// Creates a tar.gz archive from the local folder and uploads it.
#[tauri::command]
pub async fn push_workspace(
    app: AppHandle,
    agent_id: i64,
    local_path: String,
    api_key: String,
    api_base: String,
) -> Result<PushResult, String> {
    let local_dir = PathBuf::from(&local_path);

    if !local_dir.exists() {
        return Err("Local folder does not exist".to_string());
    }

    // Create tar.gz archive in memory
    let mut archive_data = Vec::new();
    let mut files_archived: u32 = 0;
    {
        let encoder = GzEncoder::new(&mut archive_data, Compression::default());
        let mut builder = tar::Builder::new(encoder);

        add_dir_to_archive(&mut builder, &local_dir, Path::new(""), &mut files_archived)
            .map_err(SyncError::Io)?;

        builder.finish().map_err(SyncError::Io)?;
    }

    // Upload the archive
    let client = reqwest::Client::new();
    let url = format!("{}/api/agents/{}/workspace/upload", api_base, agent_id);

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/gzip")
        .body(archive_data)
        .send()
        .await
        .map_err(SyncError::Http)?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(SyncError::Api(format!("Upload failed: {} - {}", status, body)).into());
    }

    // Update last sync time
    let timestamp = get_current_timestamp();
    let store = app
        .store(STORE_PATH)
        .map_err(|e| SyncError::Store(e.to_string()))?;

    let key = get_store_key(agent_id);
    let config = SyncConfig {
        folder_path: local_path,
        last_sync: Some(timestamp),
    };
    store.set(
        key,
        serde_json::to_value(&config).map_err(|e| SyncError::Store(e.to_string()))?,
    );
    store.save().map_err(|e| SyncError::Store(e.to_string()))?;

    Ok(PushResult {
        files_archived,
        timestamp,
    })
}

fn add_dir_to_archive<W: Write>(
    builder: &mut tar::Builder<W>,
    base_path: &Path,
    relative_path: &Path,
    count: &mut u32,
) -> std::io::Result<()> {
    let current_path = base_path.join(relative_path);

    for entry in fs::read_dir(&current_path)? {
        let entry = entry?;
        let entry_name = entry.file_name();
        let entry_relative = relative_path.join(&entry_name);
        let entry_full = base_path.join(&entry_relative);

        if entry_full.is_dir() {
            add_dir_to_archive(builder, base_path, &entry_relative, count)?;
        } else {
            let mut file = File::open(&entry_full)?;
            builder.append_file(&entry_relative, &mut file)?;
            *count += 1;
        }
    }

    Ok(())
}

/// Stores the API key securely.
#[tauri::command]
pub async fn store_api_key(app: AppHandle, api_key: String) -> Result<(), String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| SyncError::Store(e.to_string()))?;

    store.set(API_KEY_STORE_KEY.to_string(), serde_json::Value::String(api_key));
    store.save().map_err(|e| SyncError::Store(e.to_string()))?;

    Ok(())
}

/// Retrieves the stored API key.
#[tauri::command]
pub async fn get_api_key(app: AppHandle) -> Result<Option<String>, String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| SyncError::Store(e.to_string()))?;

    let api_key = store
        .get(API_KEY_STORE_KEY)
        .and_then(|v| v.as_str().map(String::from));

    Ok(api_key)
}
