//! Workspace Sync Commands
//!
//! Provides Tauri commands for syncing agent workspaces between
//! local folders and the remote S3-backed storage.
//!
//! Supports hash-based delta sync for efficient transfers - only changed files are sent.

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_http::reqwest;
use tauri_plugin_store::StoreExt;
use thiserror::Error;
use tokio::sync::oneshot;
use walkdir::WalkDir;

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

// ============================================================================
// Delta Sync Types
// ============================================================================

/// Signature manifest for a directory of files
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SignatureManifest {
    pub files: HashMap<String, FileSignature>,
    pub last_sync: i64,
}

/// Hash for a single file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSignature {
    pub hash: String, // SHA256 hex hash
    pub size: u64,
}

/// Result of a delta pull operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeltaPullResult {
    pub files_added: Vec<String>,
    pub files_updated: Vec<String>,
    pub files_skipped: Vec<String>, // Conflicts - saved as .agent.ext
    pub timestamp: i64,
}

/// Result of a delta push operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeltaPushResult {
    pub files_added: u32,
    pub files_updated: u32,
    pub files_deleted: u32,
    pub timestamp: i64,
}

/// Request payload for push sync
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PushSyncRequest {
    pub files: HashMap<String, String>, // path -> base64 content
    pub deleted: Vec<String>,
}

/// Request payload for pull sync
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullSyncRequest {
    pub signatures: HashMap<String, String>, // path -> hash
}

/// Response from pull sync API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullSyncResponse {
    pub success: bool,
    pub files: HashMap<String, String>, // path -> base64 content
    pub deleted: Vec<String>,
    pub signatures: SignatureManifest,
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

fn get_signatures_store_key(agent_id: i64) -> String {
    format!("agent_{}_signatures", agent_id)
}

/// Compute SHA256 hash of content
fn compute_hash(content: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content);
    format!("{:x}", hasher.finalize())
}

/// Convert file path to .agent version (e.g., file.txt -> file.agent.txt)
fn make_agent_path(path: &Path) -> PathBuf {
    let stem = path.file_stem().unwrap_or_default().to_string_lossy();
    let ext = path.extension().map(|e| e.to_string_lossy().to_string());

    let new_name = match ext {
        Some(e) => format!("{}.agent.{}", stem, e),
        None => format!("{}.agent", stem),
    };

    path.with_file_name(new_name)
}

/// Check if a path is an agent conflict file
fn is_agent_file(path: &Path) -> bool {
    path.file_name()
        .and_then(|n| n.to_str())
        .map(|n| n.contains(".agent."))
        .unwrap_or(false)
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

// ============================================================================
// Delta Sync Commands
// ============================================================================

/// Compute hashes for all files in a local directory.
#[tauri::command]
pub async fn get_local_signatures(local_path: String) -> Result<SignatureManifest, String> {
    let local_dir = PathBuf::from(&local_path);

    if !local_dir.exists() {
        return Ok(SignatureManifest::default());
    }

    let mut files = HashMap::new();

    for entry in WalkDir::new(&local_dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let path = entry.path();

        // Skip .agent conflict files
        if is_agent_file(path) {
            continue;
        }

        // Get relative path
        let relative = path
            .strip_prefix(&local_dir)
            .map_err(|e| e.to_string())?
            .to_string_lossy()
            .to_string();

        // Read file content
        let mut content = Vec::new();
        let mut file = File::open(path).map_err(|e| e.to_string())?;
        file.read_to_end(&mut content).map_err(|e| e.to_string())?;

        // Compute hash
        let hash = compute_hash(&content);
        let size = content.len() as u64;

        files.insert(relative, FileSignature { hash, size });
    }

    Ok(SignatureManifest {
        files,
        last_sync: get_current_timestamp(),
    })
}

/// Get cached signature manifest for an agent
#[tauri::command]
pub async fn get_cached_signatures(
    app: AppHandle,
    agent_id: i64,
) -> Result<Option<SignatureManifest>, String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| SyncError::Store(e.to_string()))?;

    let key = get_signatures_store_key(agent_id);
    let manifest = store
        .get(&key)
        .and_then(|v| serde_json::from_value::<SignatureManifest>(v.clone()).ok());

    Ok(manifest)
}

/// Save signature manifest to cache
fn save_signatures_to_cache(
    app: &AppHandle,
    agent_id: i64,
    manifest: &SignatureManifest,
) -> Result<(), String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| SyncError::Store(e.to_string()))?;

    let key = get_signatures_store_key(agent_id);
    store.set(
        key,
        serde_json::to_value(manifest).map_err(|e| SyncError::Store(e.to_string()))?,
    );
    store.save().map_err(|e| SyncError::Store(e.to_string()))?;

    Ok(())
}

/// Delta push: Upload only changed files (hash-based comparison).
#[tauri::command]
pub async fn push_workspace_delta(
    app: AppHandle,
    agent_id: i64,
    local_path: String,
    api_key: String,
    api_base: String,
) -> Result<DeltaPushResult, String> {
    let local_dir = PathBuf::from(&local_path);

    if !local_dir.exists() {
        return Err("Local folder does not exist".to_string());
    }

    // 1. Get remote signatures (hashes)
    let client = reqwest::Client::new();
    let url = format!("{}/api/agents/{}/workspace/signatures", api_base, agent_id);

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(SyncError::Http)?;

    #[derive(Deserialize)]
    #[allow(dead_code)]
    struct SignaturesResponse {
        success: bool,
        signatures: SignatureManifest,
    }

    let remote_manifest: SignatureManifest = if response.status().is_success() {
        let body = response.text().await.map_err(SyncError::Http)?;
        let resp: SignaturesResponse =
            serde_json::from_str(&body).map_err(|e| format!("Failed to parse signatures: {}", e))?;
        resp.signatures
    } else if response.status() == 404 {
        SignatureManifest::default()
    } else {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Failed to get remote signatures: {} - {}", status, body));
    };

    // 2. Compare local files to remote hashes
    let mut changed_files: HashMap<String, String> = HashMap::new();
    let mut local_files: HashMap<String, ()> = HashMap::new();
    let mut files_added: u32 = 0;
    let mut files_updated: u32 = 0;

    for entry in WalkDir::new(&local_dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let path = entry.path();

        // Skip .agent conflict files
        if is_agent_file(path) {
            continue;
        }

        let relative = path
            .strip_prefix(&local_dir)
            .map_err(|e| e.to_string())?
            .to_string_lossy()
            .to_string();

        local_files.insert(relative.clone(), ());

        // Read local file
        let mut content = Vec::new();
        let mut file = File::open(path).map_err(|e| e.to_string())?;
        file.read_to_end(&mut content).map_err(|e| e.to_string())?;

        let local_hash = compute_hash(&content);

        if let Some(remote_sig) = remote_manifest.files.get(&relative) {
            // File exists remotely
            if remote_sig.hash != local_hash {
                // File changed - send full content
                changed_files.insert(relative, BASE64.encode(&content));
                files_updated += 1;
            }
            // If hashes match, file unchanged - skip
        } else {
            // New file - send full content
            changed_files.insert(relative, BASE64.encode(&content));
            files_added += 1;
        }
    }

    // 3. Find deleted files (in remote but not in local)
    let deleted: Vec<String> = remote_manifest
        .files
        .keys()
        .filter(|k| !local_files.contains_key(*k))
        .cloned()
        .collect();

    let files_deleted = deleted.len() as u32;

    // 4. Send to server
    let push_url = format!("{}/api/agents/{}/workspace/sync/push", api_base, agent_id);
    let request = PushSyncRequest {
        files: changed_files,
        deleted: deleted,
    };

    let request_body = serde_json::to_string(&request)
        .map_err(|e| format!("Failed to serialize request: {}", e))?;

    let response = client
        .post(&push_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .body(request_body)
        .send()
        .await
        .map_err(SyncError::Http)?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Push sync failed: {} - {}", status, body));
    }

    // 5. Update local signature cache
    let new_manifest = get_local_signatures(local_path.clone()).await?;
    save_signatures_to_cache(&app, agent_id, &new_manifest)?;

    // 6. Update sync config timestamp
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

    Ok(DeltaPushResult {
        files_added,
        files_updated,
        files_deleted,
        timestamp,
    })
}

/// Delta pull: Download only changed files, with conflict detection.
#[tauri::command]
pub async fn pull_workspace_delta(
    app: AppHandle,
    agent_id: i64,
    local_path: String,
    api_key: String,
    api_base: String,
) -> Result<DeltaPullResult, String> {
    let local_dir = PathBuf::from(&local_path);

    // Create directory if it doesn't exist
    fs::create_dir_all(&local_dir).map_err(SyncError::Io)?;

    // 1. Get cached signatures (baseline from last sync)
    let cached_manifest = get_cached_signatures(app.clone(), agent_id)
        .await?
        .unwrap_or_default();

    // 2. Compute current local hashes
    let local_manifest = get_local_signatures(local_path.clone()).await?;

    // 3. Send local hashes to server to get changed files
    let client = reqwest::Client::new();
    let url = format!("{}/api/agents/{}/workspace/sync/pull", api_base, agent_id);

    // Build hash-only request
    let signatures: HashMap<String, String> = local_manifest
        .files
        .iter()
        .map(|(k, v)| (k.clone(), v.hash.clone()))
        .collect();

    let request = PullSyncRequest { signatures };
    let request_body = serde_json::to_string(&request)
        .map_err(|e| format!("Failed to serialize request: {}", e))?;

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .body(request_body)
        .send()
        .await
        .map_err(SyncError::Http)?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Pull sync failed: {} - {}", status, body));
    }

    let response_body = response.text().await.map_err(SyncError::Http)?;
    let pull_response: PullSyncResponse = serde_json::from_str(&response_body)
        .map_err(|e| format!("Failed to parse pull response: {}", e))?;

    let mut files_added = Vec::new();
    let mut files_updated = Vec::new();
    let mut files_skipped = Vec::new();

    // 4. Process files from server
    for (path, base64_content) in pull_response.files {
        let file_path = local_dir.join(&path);

        // Create parent directories if needed
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).map_err(SyncError::Io)?;
        }

        let content = BASE64.decode(&base64_content).map_err(|e| e.to_string())?;

        // Check if file exists locally
        if file_path.exists() {
            // Check if user edited this file (compare to cached baseline)
            let mut local_content = Vec::new();
            let mut f = File::open(&file_path).map_err(SyncError::Io)?;
            f.read_to_end(&mut local_content).map_err(SyncError::Io)?;

            let local_hash = compute_hash(&local_content);
            let cached_hash = cached_manifest.files.get(&path).map(|s| s.hash.as_str());

            if Some(local_hash.as_str()) != cached_hash {
                // User edited! Save agent version separately
                let agent_path = make_agent_path(&file_path);
                fs::write(&agent_path, &content).map_err(SyncError::Io)?;
                files_skipped.push(path);
            } else {
                // User didn't edit, safe to overwrite
                fs::write(&file_path, &content).map_err(SyncError::Io)?;
                files_updated.push(path);
            }
        } else {
            // New file from agent
            fs::write(&file_path, &content).map_err(SyncError::Io)?;
            files_added.push(path);
        }
    }

    // 5. Handle deleted files (files that exist locally but not remotely)
    // Note: We don't auto-delete - user's files are sacred
    // The deleted list is informational only

    // 6. Update signature cache with new remote signatures
    save_signatures_to_cache(&app, agent_id, &pull_response.signatures)?;

    // 7. Update sync config timestamp
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

    Ok(DeltaPullResult {
        files_added,
        files_updated,
        files_skipped,
        timestamp,
    })
}

/// Clear all .agent.* conflict files from the workspace
#[tauri::command]
pub async fn clear_agent_files(local_path: String) -> Result<u32, String> {
    let local_dir = PathBuf::from(&local_path);
    let mut count = 0;

    for entry in WalkDir::new(&local_dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        if is_agent_file(entry.path()) {
            fs::remove_file(entry.path()).map_err(|e| e.to_string())?;
            count += 1;
        }
    }

    Ok(count)
}
