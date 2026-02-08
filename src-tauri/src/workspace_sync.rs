//! Workspace Sync Commands (SFTP + rsync)
//!
//! Provides Tauri commands for syncing agent workspaces between
//! local folders and EFS via SFTP with byte-level delta sync.
//!
//! Features:
//! - SFTP transport (connects to AWS Transfer Family or local dev server)
//! - rsync algorithm for byte-level deltas (only changed bytes transfer)
//! - Filesystem watcher for event-driven sync
//! - Workspace locking during agent tasks

use fast_rsync::{Signature, SignatureOptions};
use notify::RecommendedWatcher;
use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use ssh2::{Session, Sftp};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_http::reqwest;
use tauri_plugin_store::StoreExt;
use thiserror::Error;
use tokio::sync::oneshot;
use walkdir::WalkDir;

const STORE_PATH: &str = "workspace-sync.json";
const API_KEY_STORE_KEY: &str = "api_key";

// Lock file constants
const LOCK_FILE_NAME: &str = ".emery-lock";
const LOCK_TTL_SECS: i64 = 3600; // 1 hour - ignore stale locks

// ============================================================================
// Error Types
// ============================================================================

#[derive(Error, Debug)]
pub enum SyncError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("SSH error: {0}")]
    Ssh(#[from] ssh2::Error),
    #[error("Store error: {0}")]
    Store(String),
    #[error("Dialog cancelled")]
    DialogCancelled,
    #[error("No API key configured")]
    NoApiKey,
    #[error("API error: {0}")]
    Api(String),
    #[error("SFTP error: {0}")]
    Sftp(String),
    #[error("Workspace locked by task: {0}")]
    WorkspaceLocked(String),
    #[error("Not connected")]
    NotConnected,
}

impl From<SyncError> for String {
    fn from(e: SyncError) -> String {
        e.to_string()
    }
}

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConfig {
    pub folder_path: String,
    pub last_sync: Option<i64>,
    /// SFTP host (e.g., "localhost" for dev, "sftp.yourapp.com" for prod)
    pub sftp_host: Option<String>,
    /// SFTP port (default: 22, dev: 2222)
    pub sftp_port: Option<u16>,
    /// SFTP username (e.g., "agent" for dev, "agent-{id}" for prod)
    pub sftp_user: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub connected: bool,
    pub locked: bool,
    pub locked_by_task: Option<String>,
    pub local_modified: Option<i64>,
    pub remote_modified: Option<i64>,
    pub pending_changes: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    pub files_synced: u32,
    pub bytes_transferred: u64,
    pub timestamp: i64,
    pub direction: String, // "push" or "pull"
}

/// Workspace lock state (from .emery-lock file)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceLockState {
    pub locked: bool,
    pub task_id: Option<String>,
    pub started_at: Option<i64>,
    pub agent_id: Option<i64>,
}

/// Lock file contents (JSON structure in .emery-lock)
#[derive(Debug, Clone, Serialize, Deserialize)]
struct LockFileContents {
    task_id: String,
    started_at: i64,
    agent_id: i64,
}

/// SFTP credentials for connecting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SftpCredentials {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub remote_path: String, // e.g., "/workspace" or "/{org_id}/agents/{agent_id}"
}

/// File info for sync comparison
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub path: String,
    pub size: u64,
    pub hash: String,
    pub mtime: i64,
}

/// Pending change queued during workspace lock
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingChange {
    pub path: String,
    pub change_type: String, // "create", "modify", "delete"
    pub timestamp: i64,
}

// ============================================================================
// SFTP Connection Manager
// ============================================================================

/// Manages SFTP connections per agent
pub struct SftpConnectionManager {
    connections: HashMap<i64, SftpConnection>,
}

struct SftpConnection {
    #[allow(dead_code)]
    session: Session,
    sftp: Sftp,
    remote_path: String,
}

impl SftpConnectionManager {
    pub fn new() -> Self {
        Self {
            connections: HashMap::new(),
        }
    }

    /// Connect to SFTP server for an agent
    pub fn connect(&mut self, agent_id: i64, creds: &SftpCredentials) -> Result<(), SyncError> {
        // Close existing connection if any
        self.connections.remove(&agent_id);

        // Establish TCP connection
        let tcp = TcpStream::connect(format!("{}:{}", creds.host, creds.port))?;

        // Create SSH session
        let mut session = Session::new()?;
        session.set_tcp_stream(tcp);
        session.handshake()?;

        // Authenticate with password
        session.userauth_password(&creds.username, &creds.password)?;

        if !session.authenticated() {
            return Err(SyncError::Sftp("Authentication failed".to_string()));
        }

        // Open SFTP channel
        let sftp = session.sftp()?;

        self.connections.insert(
            agent_id,
            SftpConnection {
                session,
                sftp,
                remote_path: creds.remote_path.clone(),
            },
        );

        Ok(())
    }

    /// Get SFTP connection for an agent
    fn get(&self, agent_id: i64) -> Option<&SftpConnection> {
        self.connections.get(&agent_id)
    }

    /// Disconnect from SFTP server
    pub fn disconnect(&mut self, agent_id: i64) {
        self.connections.remove(&agent_id);
    }

    /// Check if connected for an agent
    pub fn is_connected(&self, agent_id: i64) -> bool {
        self.connections.contains_key(&agent_id)
    }
}

// Global connection manager (thread-safe)
lazy_static::lazy_static! {
    static ref SFTP_MANAGER: Arc<Mutex<SftpConnectionManager>> =
        Arc::new(Mutex::new(SftpConnectionManager::new()));
}

// ============================================================================
// Filesystem Watcher Manager
// ============================================================================

/// Manages filesystem watchers per agent
pub struct WatcherManager {
    watchers: HashMap<i64, WatcherHandle>,
}

struct WatcherHandle {
    #[allow(dead_code)]
    watcher: notify_debouncer_mini::Debouncer<RecommendedWatcher>,
    path: PathBuf,
}

impl WatcherManager {
    pub fn new() -> Self {
        Self {
            watchers: HashMap::new(),
        }
    }

    /// Check if watching for an agent
    pub fn is_watching(&self, agent_id: i64) -> bool {
        self.watchers.contains_key(&agent_id)
    }

    /// Get watched path for an agent
    pub fn get_watched_path(&self, agent_id: i64) -> Option<PathBuf> {
        self.watchers.get(&agent_id).map(|h| h.path.clone())
    }

    /// Stop watching for an agent
    pub fn stop(&mut self, agent_id: i64) {
        self.watchers.remove(&agent_id);
    }
}

// Global watcher manager (thread-safe)
lazy_static::lazy_static! {
    static ref WATCHER_MANAGER: Arc<Mutex<WatcherManager>> =
        Arc::new(Mutex::new(WatcherManager::new()));
}

// ============================================================================
// Helper Functions
// ============================================================================

fn get_store_key(agent_id: i64) -> String {
    format!("agent_{}", agent_id)
}

fn get_current_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn get_pending_changes_key(agent_id: i64) -> String {
    format!("agent_{}_pending", agent_id)
}

/// Compute SHA256 hash of content
fn compute_hash(content: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content);
    format!("{:x}", hasher.finalize())
}

fn get_dir_mtime(path: &Path) -> Option<i64> {
    let mut latest: Option<i64> = None;

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let entry_path = entry.path();

            if let Ok(metadata) = entry.metadata() {
                if let Ok(modified) = metadata.modified() {
                    if let Ok(duration) = modified.duration_since(UNIX_EPOCH) {
                        let mtime = duration.as_secs() as i64;
                        latest = Some(latest.map_or(mtime, |l| l.max(mtime)));
                    }
                }
            }

            if entry_path.is_dir() {
                if let Some(sub_mtime) = get_dir_mtime(&entry_path) {
                    latest = Some(latest.map_or(sub_mtime, |l| l.max(sub_mtime)));
                }
            }
        }
    }

    latest
}

/// Get all files in a directory with their info
fn get_local_files(local_dir: &Path) -> Result<Vec<FileInfo>, SyncError> {
    let mut files = Vec::new();

    for entry in WalkDir::new(local_dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let path = entry.path();
        let relative = path
            .strip_prefix(local_dir)
            .map_err(|e| SyncError::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?
            .to_string_lossy()
            .to_string();

        let metadata = fs::metadata(path)?;
        let mut content = Vec::new();
        let mut file = File::open(path)?;
        file.read_to_end(&mut content)?;

        let mtime = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);

        files.push(FileInfo {
            path: relative,
            size: metadata.len(),
            hash: compute_hash(&content),
            mtime,
        });
    }

    Ok(files)
}

// ============================================================================
// Tauri Commands - Configuration
// ============================================================================

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
    let config = store
        .get(&key)
        .and_then(|v| serde_json::from_value::<SyncConfig>(v.clone()).ok());

    Ok(config)
}

/// Sets the sync configuration for an agent.
#[tauri::command]
pub async fn set_sync_config(
    app: AppHandle,
    agent_id: i64,
    folder_path: String,
    sftp_host: Option<String>,
    sftp_port: Option<u16>,
    sftp_user: Option<String>,
) -> Result<(), String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| SyncError::Store(e.to_string()))?;

    let key = get_store_key(agent_id);
    let config = SyncConfig {
        folder_path,
        last_sync: None,
        sftp_host,
        sftp_port,
        sftp_user,
    };

    store.set(
        key,
        serde_json::to_value(&config).map_err(|e| SyncError::Store(e.to_string()))?,
    );
    store.save().map_err(|e| SyncError::Store(e.to_string()))?;

    Ok(())
}

/// Stores the API key securely.
#[tauri::command]
pub async fn store_api_key(app: AppHandle, api_key: String) -> Result<(), String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| SyncError::Store(e.to_string()))?;

    store.set(
        API_KEY_STORE_KEY.to_string(),
        serde_json::Value::String(api_key),
    );
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
// Tauri Commands - SFTP Connection
// ============================================================================

/// Connect to SFTP server for an agent workspace
#[tauri::command]
pub async fn sftp_connect(
    _app: AppHandle,
    agent_id: i64,
    api_key: String,
    api_base: String,
) -> Result<(), String> {
    // Get workspace root from env var (configurable for local vs production)
    let sftp_root = std::env::var("SFTP_WORKSPACE_ROOT").unwrap_or_else(|_| "/config/workspace".to_string());

    // Get SFTP credentials from API
    let client = reqwest::Client::new();
    let url = format!(
        "{}/api/agents/{}/workspace/sftp-credentials",
        api_base, agent_id
    );

    log::debug!("Fetching SFTP credentials from: {}", url);

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(SyncError::Http)?;

    if !response.status().is_success() {
        log::info!("API returned {}, falling back to local dev credentials", response.status());

        // Fall back to local dev credentials (linuxserver/openssh-server)
        // Path: {SFTP_WORKSPACE_ROOT}/agents/{agent_id}
        let remote_path = format!("{}/agents/{}", sftp_root, agent_id);

        let creds = SftpCredentials {
            host: "localhost".to_string(),
            port: 2222,
            username: "agent".to_string(),
            password: "test123".to_string(),
            remote_path: remote_path.clone(),
        };

        let mut manager = SFTP_MANAGER.lock().map_err(|e| e.to_string())?;
        manager.connect(agent_id, &creds)?;

        // Create agent workspace directory if it doesn't exist
        if let Some(conn) = manager.get(agent_id) {
            let path = std::path::Path::new(&remote_path);
            log::debug!("Ensuring workspace directory exists: {}", remote_path);
            // Create parent dirs recursively
            create_remote_dirs(&conn.sftp, path).ok();
        }

        log::info!("Connected to local SFTP, workspace: {}", remote_path);
        return Ok(());
    }

    // Parse response body manually
    let body = response.text().await.map_err(SyncError::Http)?;

    #[derive(Deserialize)]
    struct CredsResponse {
        #[allow(dead_code)]
        success: bool,
        credentials: SftpCredentials,
    }

    let creds_resp: CredsResponse =
        serde_json::from_str(&body).map_err(|e| format!("Failed to parse credentials: {}", e))?;

    let mut manager = SFTP_MANAGER.lock().map_err(|e| e.to_string())?;
    manager.connect(agent_id, &creds_resp.credentials)?;

    log::info!("Connected to SFTP, workspace: {}", creds_resp.credentials.remote_path);

    Ok(())
}

/// Disconnect from SFTP server
#[tauri::command]
pub async fn sftp_disconnect(agent_id: i64) -> Result<(), String> {
    let mut manager = SFTP_MANAGER.lock().map_err(|e| e.to_string())?;
    manager.disconnect(agent_id);
    Ok(())
}

/// Check SFTP connection status
#[tauri::command]
pub async fn sftp_is_connected(agent_id: i64) -> Result<bool, String> {
    let manager = SFTP_MANAGER.lock().map_err(|e| e.to_string())?;
    Ok(manager.is_connected(agent_id))
}

// ============================================================================
// Tauri Commands - Workspace Lock (File-Based)
// ============================================================================

/// Check workspace lock status by reading .emery-lock file via SFTP
#[tauri::command]
pub async fn check_workspace_lock(agent_id: i64) -> Result<WorkspaceLockState, String> {
    let manager = SFTP_MANAGER.lock().map_err(|e| e.to_string())?;

    let conn = match manager.get(agent_id) {
        Some(c) => c,
        None => {
            // Not connected - assume unlocked
            return Ok(WorkspaceLockState {
                locked: false,
                task_id: None,
                started_at: None,
                agent_id: None,
            });
        }
    };

    let lock_path = format!("{}/{}", conn.remote_path, LOCK_FILE_NAME);
    let remote_path = std::path::Path::new(&lock_path);

    // Try to read the lock file
    match conn.sftp.open(remote_path) {
        Ok(mut file) => {
            let mut content = String::new();
            if file.read_to_string(&mut content).is_err() {
                // Can't read file - assume unlocked
                return Ok(WorkspaceLockState {
                    locked: false,
                    task_id: None,
                    started_at: None,
                    agent_id: None,
                });
            }

            // Parse lock file JSON
            let lock_data: LockFileContents = match serde_json::from_str(&content) {
                Ok(data) => data,
                Err(_) => {
                    // Invalid lock file - assume unlocked
                    return Ok(WorkspaceLockState {
                        locked: false,
                        task_id: None,
                        started_at: None,
                        agent_id: None,
                    });
                }
            };

            // Check if lock is stale
            let now = get_current_timestamp();
            let age = now - lock_data.started_at;

            if age > LOCK_TTL_SECS {
                // Lock is stale - ignore it
                log::info!(
                    "Ignoring stale lock for agent {} (age: {}s > {}s TTL)",
                    agent_id,
                    age,
                    LOCK_TTL_SECS
                );
                return Ok(WorkspaceLockState {
                    locked: false,
                    task_id: Some(lock_data.task_id),
                    started_at: Some(lock_data.started_at),
                    agent_id: Some(lock_data.agent_id),
                });
            }

            // Valid lock
            Ok(WorkspaceLockState {
                locked: true,
                task_id: Some(lock_data.task_id),
                started_at: Some(lock_data.started_at),
                agent_id: Some(lock_data.agent_id),
            })
        }
        Err(_) => {
            // No lock file - workspace is unlocked
            Ok(WorkspaceLockState {
                locked: false,
                task_id: None,
                started_at: None,
                agent_id: None,
            })
        }
    }
}

// ============================================================================
// Tauri Commands - Sync Status
// ============================================================================

/// Get comprehensive sync status
#[tauri::command]
pub async fn check_sync_status(
    app: AppHandle,
    agent_id: i64,
    _api_key: String,
    _api_base: String,
) -> Result<SyncStatus, String> {
    // Get local config
    let store = app
        .store(STORE_PATH)
        .map_err(|e| SyncError::Store(e.to_string()))?;

    let key = get_store_key(agent_id);
    let config: Option<SyncConfig> = store
        .get(&key)
        .and_then(|v| serde_json::from_value(v.clone()).ok());

    let config = config.ok_or_else(|| "No sync config found".to_string())?;
    let local_path = PathBuf::from(&config.folder_path);

    // Get local mtime
    let local_modified = get_dir_mtime(&local_path);

    // Check connection status
    let connected = {
        let manager = SFTP_MANAGER.lock().map_err(|e| e.to_string())?;
        manager.is_connected(agent_id)
    };

    // Check workspace lock via SFTP (reads .emery-lock file)
    let lock_state = check_workspace_lock(agent_id).await?;

    // Get pending changes count
    let pending_key = get_pending_changes_key(agent_id);
    let pending_changes: Vec<PendingChange> = store
        .get(&pending_key)
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();

    Ok(SyncStatus {
        connected,
        locked: lock_state.locked,
        locked_by_task: lock_state.task_id,
        local_modified,
        remote_modified: None, // TODO: get from SFTP stat
        pending_changes: pending_changes.len() as u32,
    })
}

// ============================================================================
// Tauri Commands - rsync Sync
// ============================================================================

/// Push local changes to remote using rsync algorithm
#[tauri::command]
pub async fn push_workspace(
    app: AppHandle,
    agent_id: i64,
    local_path: String,
    _api_key: String,
    _api_base: String,
) -> Result<SyncResult, String> {
    log::info!("push_workspace: agent_id={}, local_path={}", agent_id, local_path);

    let local_dir = PathBuf::from(&local_path);

    if !local_dir.exists() {
        log::error!("push_workspace: Local folder does not exist: {}", local_path);
        return Err(format!("Local folder does not exist: {}", local_path));
    }

    // Check workspace lock first (reads .emery-lock file via SFTP)
    let lock_state = check_workspace_lock(agent_id).await?;
    if lock_state.locked {
        log::info!("push_workspace: Workspace locked by task {:?}, queuing changes", lock_state.task_id);
        // Queue changes instead of syncing
        return queue_pending_changes(app, agent_id, local_path, "push").await;
    }

    // Ensure connected
    let manager = SFTP_MANAGER.lock().map_err(|e| {
        log::error!("push_workspace: Failed to acquire SFTP manager lock: {}", e);
        e.to_string()
    })?;
    let conn = manager
        .get(agent_id)
        .ok_or_else(|| {
            log::error!("push_workspace: Not connected to SFTP for agent_id={}", agent_id);
            SyncError::NotConnected.to_string()
        })?;

    log::debug!("push_workspace: Using remote_path: {}", conn.remote_path);

    // Get local files
    let local_files = get_local_files(&local_dir)?;

    let mut files_synced = 0u32;
    let mut bytes_transferred = 0u64;

    // Sync each file using rsync algorithm
    for file_info in &local_files {
        let local_file_path = local_dir.join(&file_info.path);
        let remote_file_path = format!("{}/{}", conn.remote_path, file_info.path);

        // Read local file
        let mut local_content = Vec::new();
        let mut f = File::open(&local_file_path).map_err(|e| e.to_string())?;
        f.read_to_end(&mut local_content).map_err(|e| e.to_string())?;

        // Try to get remote file for delta comparison
        let remote_path = std::path::Path::new(&remote_file_path);
        let remote_content = match conn.sftp.open(remote_path) {
            Ok(mut remote_file) => {
                let mut content = Vec::new();
                remote_file.read_to_end(&mut content).ok();
                Some(content)
            }
            Err(_) => None,
        };

        // Calculate delta using rsync algorithm
        let (data_to_send, _is_delta) = if let Some(ref remote) = remote_content {
            // Use rsync algorithm for byte-level delta
            let signature = Signature::calculate(
                remote,
                SignatureOptions {
                    block_size: 2048,
                    crypto_hash_size: 8,
                },
            );

            // Index the signature for diff calculation
            let indexed = signature.index();

            let mut diff = Vec::new();
            fast_rsync::diff(&indexed, &local_content, &mut diff)
                .map_err(|e| format!("rsync diff error: {}", e))?;

            // Only use delta if it's smaller
            if diff.len() < local_content.len() {
                (diff, true)
            } else {
                (local_content.clone(), false)
            }
        } else {
            // No remote file, send full content
            (local_content.clone(), false)
        };

        bytes_transferred += data_to_send.len() as u64;

        // Ensure remote directory exists
        if let Some(parent) = remote_path.parent() {
            // Create parent directories recursively
            log::debug!("push_workspace: Creating remote directory: {:?}", parent);
            if let Err(e) = create_remote_dirs(&conn.sftp, parent) {
                log::error!("push_workspace: Failed to create remote directory {:?}: {}", parent, e);
                return Err(format!("Failed to create remote directory {:?}: {}", parent, e));
            }
        }

        // Write to remote (always send full file for now since SFTP doesn't support apply)
        // In production with delta, we'd send to a server-side apply endpoint
        log::debug!("push_workspace: Writing file to {:?}", remote_path);
        let mut remote_file = conn
            .sftp
            .create(remote_path)
            .map_err(|e| {
                log::error!("push_workspace: Failed to create remote file {:?}: {}", remote_path, e);
                SyncError::Sftp(format!("Failed to create remote file {:?}: {}", remote_path, e))
            })?;
        remote_file
            .write_all(&local_content)
            .map_err(|e| {
                log::error!("push_workspace: Failed to write to remote file {:?}: {}", remote_path, e);
                SyncError::Io(e)
            })?;

        files_synced += 1;
        log::debug!("push_workspace: Synced file {} ({} bytes)", file_info.path, local_content.len());
    }

    // Clear pending changes since we just synced
    let store = app
        .store(STORE_PATH)
        .map_err(|e| SyncError::Store(e.to_string()))?;

    let pending_key = get_pending_changes_key(agent_id);
    store.delete(&pending_key);
    store.save().map_err(|e| SyncError::Store(e.to_string()))?;

    // Update last sync time
    let timestamp = get_current_timestamp();
    let key = get_store_key(agent_id);
    let config = SyncConfig {
        folder_path: local_path,
        last_sync: Some(timestamp),
        sftp_host: None,
        sftp_port: None,
        sftp_user: None,
    };
    store.set(
        key,
        serde_json::to_value(&config).map_err(|e| SyncError::Store(e.to_string()))?,
    );
    store.save().map_err(|e| SyncError::Store(e.to_string()))?;

    drop(manager); // Release lock before returning

    Ok(SyncResult {
        files_synced,
        bytes_transferred,
        timestamp,
        direction: "push".to_string(),
    })
}

/// Pull remote changes to local using rsync algorithm
#[tauri::command]
pub async fn pull_workspace(
    app: AppHandle,
    agent_id: i64,
    local_path: String,
    _api_key: String,
    _api_base: String,
) -> Result<SyncResult, String> {
    let local_dir = PathBuf::from(&local_path);

    // Create directory if it doesn't exist
    fs::create_dir_all(&local_dir).map_err(SyncError::Io)?;

    // Get connection
    let manager = SFTP_MANAGER.lock().map_err(|e| e.to_string())?;
    let conn = manager
        .get(agent_id)
        .ok_or_else(|| SyncError::NotConnected.to_string())?;

    // List remote files
    let remote_files = list_remote_files(&conn.sftp, &conn.remote_path)?;

    let mut files_synced = 0u32;
    let mut bytes_transferred = 0u64;

    for remote_info in &remote_files {
        let local_file_path = local_dir.join(&remote_info.path);
        let remote_file_path = format!("{}/{}", conn.remote_path, remote_info.path);

        // Read remote file
        let remote_path = std::path::Path::new(&remote_file_path);
        let mut remote_file = conn
            .sftp
            .open(remote_path)
            .map_err(|e| SyncError::Sftp(e.to_string()))?;

        let mut remote_content = Vec::new();
        remote_file
            .read_to_end(&mut remote_content)
            .map_err(|e| e.to_string())?;

        // Check if local file exists and needs update
        let needs_update = if local_file_path.exists() {
            let mut local_content = Vec::new();
            let mut f = File::open(&local_file_path).map_err(|e| e.to_string())?;
            f.read_to_end(&mut local_content)
                .map_err(|e| e.to_string())?;

            compute_hash(&local_content) != compute_hash(&remote_content)
        } else {
            true
        };

        if needs_update {
            // Ensure local directory exists
            if let Some(parent) = local_file_path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }

            // Write to local
            let mut f = File::create(&local_file_path).map_err(|e| e.to_string())?;
            f.write_all(&remote_content).map_err(|e| e.to_string())?;

            bytes_transferred += remote_content.len() as u64;
            files_synced += 1;
        }
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
        sftp_host: None,
        sftp_port: None,
        sftp_user: None,
    };
    store.set(
        key,
        serde_json::to_value(&config).map_err(|e| SyncError::Store(e.to_string()))?,
    );
    store.save().map_err(|e| SyncError::Store(e.to_string()))?;

    drop(manager);

    Ok(SyncResult {
        files_synced,
        bytes_transferred,
        timestamp,
        direction: "pull".to_string(),
    })
}

/// Queue pending changes when workspace is locked
async fn queue_pending_changes(
    app: AppHandle,
    agent_id: i64,
    local_path: String,
    change_type: &str,
) -> Result<SyncResult, String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| SyncError::Store(e.to_string()))?;

    let pending_key = get_pending_changes_key(agent_id);
    let mut pending: Vec<PendingChange> = store
        .get(&pending_key)
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();

    pending.push(PendingChange {
        path: local_path,
        change_type: change_type.to_string(),
        timestamp: get_current_timestamp(),
    });

    store.set(
        pending_key,
        serde_json::to_value(&pending).map_err(|e| SyncError::Store(e.to_string()))?,
    );
    store.save().map_err(|e| SyncError::Store(e.to_string()))?;

    Ok(SyncResult {
        files_synced: 0,
        bytes_transferred: 0,
        timestamp: get_current_timestamp(),
        direction: "queued".to_string(),
    })
}

/// Sync pending changes after workspace unlocks
#[tauri::command]
pub async fn sync_pending_changes(
    app: AppHandle,
    agent_id: i64,
    api_key: String,
    api_base: String,
) -> Result<SyncResult, String> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| SyncError::Store(e.to_string()))?;

    let pending_key = get_pending_changes_key(agent_id);
    let pending: Vec<PendingChange> = store
        .get(&pending_key)
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();

    if pending.is_empty() {
        return Ok(SyncResult {
            files_synced: 0,
            bytes_transferred: 0,
            timestamp: get_current_timestamp(),
            direction: "none".to_string(),
        });
    }

    // Get sync config to find local path
    let key = get_store_key(agent_id);
    let config: SyncConfig = store
        .get(&key)
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .ok_or_else(|| "No sync config found".to_string())?;

    // Push the pending changes
    push_workspace(app, agent_id, config.folder_path, api_key, api_base).await
}

// ============================================================================
// SFTP Helper Functions
// ============================================================================

/// Create remote directories recursively
fn create_remote_dirs(sftp: &Sftp, path: &Path) -> Result<(), SyncError> {
    let mut current = PathBuf::new();

    for component in path.components() {
        current.push(component);
        let _ = sftp.mkdir(&current, 0o755); // Ignore errors (dir may exist)
    }

    Ok(())
}

/// List all files in remote directory recursively
fn list_remote_files(sftp: &Sftp, remote_path: &str) -> Result<Vec<FileInfo>, SyncError> {
    let mut files = Vec::new();
    list_remote_files_recursive(sftp, remote_path, "", &mut files)?;
    Ok(files)
}

fn list_remote_files_recursive(
    sftp: &Sftp,
    base_path: &str,
    relative_path: &str,
    files: &mut Vec<FileInfo>,
) -> Result<(), SyncError> {
    let current_path = if relative_path.is_empty() {
        base_path.to_string()
    } else {
        format!("{}/{}", base_path, relative_path)
    };

    let entries = sftp
        .readdir(std::path::Path::new(&current_path))
        .map_err(|e| SyncError::Sftp(e.to_string()))?;

    for (path, stat) in entries {
        let file_name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        // Skip . and ..
        if file_name == "." || file_name == ".." {
            continue;
        }

        let rel_path = if relative_path.is_empty() {
            file_name.clone()
        } else {
            format!("{}/{}", relative_path, file_name)
        };

        if stat.is_dir() {
            list_remote_files_recursive(sftp, base_path, &rel_path, files)?;
        } else if stat.is_file() {
            files.push(FileInfo {
                path: rel_path,
                size: stat.size.unwrap_or(0),
                hash: String::new(), // Hash computed on demand
                mtime: stat.mtime.unwrap_or(0) as i64,
            });
        }
    }

    Ok(())
}

// ============================================================================
// Tauri Commands - Filesystem Watcher
// ============================================================================

/// Event emitted when files change in watched directory
#[derive(Debug, Clone, Serialize)]
pub struct FileChangeEvent {
    pub agent_id: i64,
    pub paths: Vec<String>,
    pub timestamp: i64,
}

/// Start watching a folder for changes
#[tauri::command]
pub async fn start_watching(
    app: AppHandle,
    agent_id: i64,
    local_path: String,
) -> Result<(), String> {
    let path = PathBuf::from(&local_path);

    if !path.exists() {
        return Err("Path does not exist".to_string());
    }

    // Clone what we need for the closure
    let app_handle = app.clone();
    let watch_path = path.clone();

    // Create debounced watcher with 500ms delay
    let mut debouncer = new_debouncer(
        Duration::from_millis(500),
        move |res: Result<Vec<notify_debouncer_mini::DebouncedEvent>, notify::Error>| {
            match res {
                Ok(events) => {
                    // Filter for actual file changes
                    let changed_paths: Vec<String> = events
                        .iter()
                        .filter(|e| matches!(e.kind, DebouncedEventKind::Any))
                        .map(|e| e.path.to_string_lossy().to_string())
                        .collect();

                    if !changed_paths.is_empty() {
                        // Emit event to frontend
                        let event = FileChangeEvent {
                            agent_id,
                            paths: changed_paths,
                            timestamp: get_current_timestamp(),
                        };

                        // Emit to frontend via Tauri event system
                        let _ = app_handle.emit("workspace-file-change", event);
                    }
                }
                Err(e) => {
                    log::error!("Watch error for agent {}: {:?}", agent_id, e);
                }
            }
        },
    )
    .map_err(|e| format!("Failed to create watcher: {}", e))?;

    // Start watching
    debouncer
        .watcher()
        .watch(&watch_path, notify::RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to start watching: {}", e))?;

    // Store the watcher
    let mut manager = WATCHER_MANAGER.lock().map_err(|e| e.to_string())?;

    // Remove existing watcher if any
    manager.stop(agent_id);

    // Store new watcher
    manager.watchers.insert(
        agent_id,
        WatcherHandle {
            watcher: debouncer,
            path,
        },
    );

    Ok(())
}

/// Stop watching a folder
#[tauri::command]
pub async fn stop_watching(agent_id: i64) -> Result<(), String> {
    let mut manager = WATCHER_MANAGER.lock().map_err(|e| e.to_string())?;
    manager.stop(agent_id);
    Ok(())
}

/// Check if watching a folder
#[tauri::command]
pub async fn is_watching(agent_id: i64) -> Result<bool, String> {
    let manager = WATCHER_MANAGER.lock().map_err(|e| e.to_string())?;
    Ok(manager.is_watching(agent_id))
}

/// Get watched path for an agent
#[tauri::command]
pub async fn get_watched_path(agent_id: i64) -> Result<Option<String>, String> {
    let manager = WATCHER_MANAGER.lock().map_err(|e| e.to_string())?;
    Ok(manager
        .get_watched_path(agent_id)
        .map(|p| p.to_string_lossy().to_string()))
}

// ============================================================================
// Deprecated HTTP Commands (kept for backwards compatibility)
// ============================================================================

/// DEPRECATED: Use push_workspace instead (now uses SFTP)
#[tauri::command]
pub async fn push_workspace_delta(
    app: AppHandle,
    agent_id: i64,
    local_path: String,
    api_key: String,
    api_base: String,
) -> Result<SyncResult, String> {
    // Redirect to new SFTP-based push
    push_workspace(app, agent_id, local_path, api_key, api_base).await
}

/// DEPRECATED: Use pull_workspace instead (now uses SFTP)
#[tauri::command]
pub async fn pull_workspace_delta(
    app: AppHandle,
    agent_id: i64,
    local_path: String,
    api_key: String,
    api_base: String,
) -> Result<SyncResult, String> {
    // Redirect to new SFTP-based pull
    pull_workspace(app, agent_id, local_path, api_key, api_base).await
}

/// DEPRECATED: No longer needed with SFTP
#[tauri::command]
pub async fn get_local_signatures(_local_path: String) -> Result<HashMap<String, String>, String> {
    Ok(HashMap::new())
}

/// DEPRECATED: No longer needed with SFTP
#[tauri::command]
pub async fn get_cached_signatures(
    _app: AppHandle,
    _agent_id: i64,
) -> Result<Option<HashMap<String, String>>, String> {
    Ok(None)
}

/// DEPRECATED: No longer needed with SFTP
#[tauri::command]
pub async fn clear_agent_files(_local_path: String) -> Result<u32, String> {
    Ok(0)
}
