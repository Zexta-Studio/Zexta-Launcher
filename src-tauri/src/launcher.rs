use std::fs::{self, File};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use serde_json::Value;
use sha2::{Sha256, Digest};
use zip::read::ZipArchive;

static ACTIVE_GAME_PROCESS: LazyLock<Mutex<Option<Child>>> = LazyLock::new(|| Mutex::new(None));

use std::sync::LazyLock;

#[derive(serde::Serialize, Clone)]
struct ProgressPayload {
    #[serde(rename = "type")]
    progress_type: String,
    task: u64,
    total: u64,
    message: String,
}

// Helper to get machine fingerprint (Rust port)
fn get_machine_fingerprint() -> String {
    let username = whoami::username();
    let platform = std::env::consts::OS;
    let data = format!("rust-fingerprint-{}-{}", username, platform);
    let mut hasher = Sha256::new();
    hasher.update(data);
    format!("{:x}", hasher.finalize())
}

// Helper to download a file with progress, percentage, network speed, and 3-attempt retries
async fn download_file_with_progress(
    app: &AppHandle,
    client: &reqwest::Client,
    url: &str,
    dest_path: &Path,
    progress_type: &str,
    current_item: u64,
    total_items: u64,
) -> Result<(), String> {
    let mut last_error = String::new();
    
    for attempt in 1..=3 {
        match client.get(url).send().await {
            Ok(mut response) => {
                let total_size = response.content_length().unwrap_or(0);
                if let Some(parent) = dest_path.parent() {
                    let _ = fs::create_dir_all(parent);
                }
                
                match File::create(dest_path) {
                    Ok(mut file) => {
                        let mut downloaded = 0;
                        let mut last_progress_time = tokio::time::Instant::now();
                        let mut last_downloaded = 0;
                        let mut speed_kb_s = 0.0;
                        let mut chunk_err = false;

                        while let Some(chunk) = response.chunk().await.unwrap_or(None) {
                            if let Err(e) = file.write_all(&chunk) {
                                last_error = format!("File write error: {}", e);
                                chunk_err = true;
                                break;
                            }
                            downloaded += chunk.len() as u64;
                            
                            let now = tokio::time::Instant::now();
                            let elapsed_since_last = now.duration_since(last_progress_time).as_secs_f64();
                            if elapsed_since_last >= 0.4 || downloaded == total_size {
                                let bytes_in_interval = downloaded - last_downloaded;
                                if elapsed_since_last > 0.0 {
                                    speed_kb_s = (bytes_in_interval as f64 / 1024.0) / elapsed_since_last;
                                }
                                last_progress_time = now;
                                last_downloaded = downloaded;

                                let speed_str = if speed_kb_s > 1024.0 {
                                    format!("{:.1} MB/s", speed_kb_s / 1024.0)
                                } else {
                                    format!("{:.0} KB/s", speed_kb_s)
                                };

                                let file_pct = if total_size > 0 {
                                    (downloaded * 100) / total_size
                                } else {
                                    0
                                };

                                let filename = dest_path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                                
                                let message = if total_items > 1 {
                                    format!("[{}/{}] {} ({}%) - {}", current_item, total_items, filename, file_pct, speed_str)
                                } else {
                                    format!("{} ({}%) - {}", filename, file_pct, speed_str)
                                };

                                let _ = app.emit("launch-progress", serde_json::json!({
                                    "type": progress_type,
                                    "task": downloaded,
                                    "total": total_size,
                                    "message": message,
                                    "speed": speed_str,
                                    "pct": file_pct,
                                    "current": current_item,
                                    "max": total_items
                                }));
                            }
                        }

                        if !chunk_err {
                            if total_size > 0 && downloaded != total_size {
                                last_error = format!("Incomplete download: {}/{}", downloaded, total_size);
                            } else {
                                return Ok(()); // Success!
                            }
                        }
                    }
                    Err(e) => {
                        last_error = format!("File create error: {}", e);
                    }
                }
            }
            Err(e) => {
                last_error = format!("HTTP request error: {}", e);
            }
        }
        
        // Wait before retry
        tokio::time::sleep(std::time::Duration::from_millis(250 * attempt)).await;
    }
    
    Err(format!("Download failed after 3 attempts: {}", last_error))
}

// ─── Module 1: Mod Syncing from Modrinth ───
pub async fn sync_mods_rust(app: AppHandle, zip_url: String) -> Result<bool, String> {
    let data_dir = dirs::data_dir().ok_or("Failed to get data dir")?;
    let mc_path = data_dir.join("ZextaProject").join("game");
    let mods_path = mc_path.join("mods");

    let sig_path = mc_path.join(".launcher_sig");
    if sig_path.exists() {
        let _ = fs::remove_file(&sig_path);
    }

    fs::create_dir_all(&mc_path).map_err(|e| e.to_string())?;
    fs::create_dir_all(&mods_path).map_err(|e| e.to_string())?;

    let client = reqwest::Client::new();
    let temp_file_path = std::env::temp_dir().join(if zip_url.ends_with(".mrpack") { "pack.mrpack" } else { "mods.zip" });

    println!("[Launcher] Downloading modpack: {}", zip_url);
    
    // Download pack with progress
    download_file_with_progress(&app, &client, &zip_url, &temp_file_path, "mod", 1, 1).await?;

    let file = File::open(&temp_file_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

    if zip_url.ends_with(".mrpack") {
        println!("[Launcher] Extracting Modrinth Pack");
        let (files, total_files) = {
            let mut index_entry = archive.by_name("modrinth.index.json").map_err(|e| e.to_string())?;
            let index_json: Value = serde_json::from_reader(&mut index_entry).map_err(|e| e.to_string())?;
            let files = index_json["files"].as_array().ok_or("Invalid Modrinth pack structure")?.clone();
            let len = files.len() as u64;
            (files, len)
        };
        let mut count = 0;
        let mut mod_names_in_pack = Vec::new();

        for file_info in &files {
            count += 1;
            let path_str = file_info["path"].as_str().ok_or("Missing file path")?;
            let dest_path = mc_path.join(path_str);
            let dest_dir = dest_path.parent().ok_or("Invalid parent directory")?;

            if path_str.starts_with("mods/") {
                if let Some(filename) = dest_path.file_name() {
                    if let Some(name_str) = filename.to_str() {
                        mod_names_in_pack.push(name_str.to_string());
                    }
                }
            }

            fs::create_dir_all(dest_dir).map_err(|e| e.to_string())?;

            let download_url = file_info["downloads"][0].as_str().ok_or("Missing download URL")?;
            let file_size = file_info["fileSize"].as_u64().unwrap_or(0);

            // Check if file exists and matches size
            if dest_path.exists() {
                if let Ok(meta) = fs::metadata(&dest_path) {
                    if meta.len() == file_size {
                        continue;
                    }
                }
            }

            // Download individual mod with progress and retry
            download_file_with_progress(&app, &client, download_url, &dest_path, "mod", count, total_files).await?;
        }

        // Clean extra mods
        if mods_path.exists() {
            if let Ok(entries) = fs::read_dir(&mods_path) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() {
                        if let Some(filename) = path.file_name() {
                            if let Some(filename_str) = filename.to_str() {
                                if filename_str.ends_with(".jar") && !mod_names_in_pack.contains(&filename_str.to_string()) {
                                    let _ = fs::remove_file(path);
                                }
                            }
                        }
                    }
                }
            }
        }

        // Extract overrides
        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
            let outpath = match file.enclosed_name() {
                Some(path) => path.to_owned(),
                None => continue,
            };

            if outpath.starts_with("overrides/") {
                let rel_path = outpath.strip_prefix("overrides/").unwrap();
                let dest_path = mc_path.join(rel_path);

                if file.name().ends_with('/') {
                    fs::create_dir_all(&dest_path).map_err(|e| e.to_string())?;
                } else {
                    if let Some(p) = dest_path.parent() {
                        fs::create_dir_all(p).map_err(|e| e.to_string())?;
                    }
                    let mut outfile = File::create(&dest_path).map_err(|e| e.to_string())?;
                    io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
                }
            }
        }

        // Save signature
        let signature_path = mc_path.join(".launcher_sig");
        let sig = serde_json::json!({
            "launcher": "Zexta Launcher",
            "version": "2.5.0",
            "timestamp": chrono::Utc::now().timestamp_millis(),
            "machine": get_machine_fingerprint(),
            "key": "ZEXTA_SECURE_KEY_9988",
            "packSource": zip_url,
        });
        fs::write(signature_path, sig.to_string()).map_err(|e| e.to_string())?;
    } else {
        // Direct zip extraction
        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
            let outpath = match file.enclosed_name() {
                Some(path) => path.to_owned(),
                None => continue,
            };
            let dest_path = mc_path.join(&outpath);

            if file.name().ends_with('/') {
                fs::create_dir_all(&dest_path).map_err(|e| e.to_string())?;
            } else {
                if let Some(p) = dest_path.parent() {
                    fs::create_dir_all(p).map_err(|e| e.to_string())?;
                }
                let mut outfile = File::create(&dest_path).map_err(|e| e.to_string())?;
                io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
            }
        }
    }

    let _ = fs::remove_file(temp_file_path);
    Ok(true)
}

fn is_library_allowed(rules: &Value) -> bool {
    if let Some(rules_array) = rules.as_array() {
        let mut allowed = false;
        for rule in rules_array {
            let action = rule["action"].as_str().unwrap_or("allow");
            let os_name = rule["os"]["name"].as_str().unwrap_or("");
            
            let current_os = if cfg!(target_os = "windows") {
                "windows"
            } else if cfg!(target_os = "macos") {
                "osx"
            } else {
                "linux"
            };

            if os_name.is_empty() {
                allowed = action == "allow";
            } else if os_name == current_os {
                allowed = action == "allow";
            }
        }
        allowed
    } else {
        true
    }
}

// ─── Module 2: Game Assets & Fabric Installer ───
pub async fn prepare_game_rust(app: AppHandle, _options: Value) -> Result<bool, String> {
    let data_dir = dirs::data_dir().ok_or("Failed to get data dir")?;
    let mc_path = data_dir.join("ZextaProject").join("game");
    
    let mc_version = _options["version"].as_str().unwrap_or("1.21.1");
    let zip_url = _options["modpackUrl"].as_str().unwrap_or("");

    let client = reqwest::Client::new();

    // ─── Phase 0: Auto-download local Java 21 JRE from Adoptium Temurin ───
    let runtime_dir = mc_path.parent().unwrap().join("runtime").join("java21");
    let java_exe_path = if cfg!(target_os = "windows") {
        runtime_dir.join("bin").join("java.exe")
    } else {
        runtime_dir.join("bin").join("java")
    };

    if !java_exe_path.exists() {
        println!("[Launcher] Downloading Java 21 Runtime (Adoptium Temurin)...");
        let java_url = if cfg!(target_os = "windows") {
            "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%2B13/OpenJDK21U-jre_x64_windows_hotspot_21.0.2_13.zip"
        } else if cfg!(target_os = "macos") {
            if cfg!(target_arch = "aarch64") {
                "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%2B13/OpenJDK21U-jre_aarch64_mac_hotspot_21.0.2_13.tar.gz"
            } else {
                "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%2B13/OpenJDK21U-jre_x64_mac_hotspot_21.0.2_13.tar.gz"
            }
        } else {
            if cfg!(target_arch = "aarch64") {
                "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%2B13/OpenJDK21U-jre_aarch64_linux_hotspot_21.0.2_13.tar.gz"
            } else {
                "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%2B13/OpenJDK21U-jre_x64_linux_hotspot_21.0.2_13.tar.gz"
            }
        };

        let temp_zip = std::env::temp_dir().join("java21.zip");
        download_file_with_progress(&app, &client, java_url, &temp_zip, "java", 1, 1).await?;

        let _ = app.emit("launch-progress", ProgressPayload {
            progress_type: "java".to_string(),
            task: 100,
            total: 100,
            message: "Extracting Java 21 Runtime...".to_string(),
        });

        let file = File::open(&temp_zip).map_err(|e| e.to_string())?;
        
        if java_url.ends_with(".zip") {
            let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
            let extract_dest = runtime_dir.parent().unwrap();
            let mut root_folder = String::new();
            if archive.len() > 0 {
                if let Ok(first_entry) = archive.by_index(0) {
                    let name = first_entry.name();
                    if let Some(slash_idx) = name.find('/') {
                        root_folder = name[0..slash_idx].to_string();
                    }
                }
            }

            for i in 0..archive.len() {
                let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
                let outpath = match file.enclosed_name() {
                    Some(path) => path.to_owned(),
                    None => continue,
                };
                let dest_path = extract_dest.join(&outpath);

                if file.name().ends_with('/') {
                    fs::create_dir_all(&dest_path).map_err(|e| e.to_string())?;
                } else {
                    if let Some(p) = dest_path.parent() {
                        fs::create_dir_all(p).map_err(|e| e.to_string())?;
                    }
                    let mut outfile = File::create(&dest_path).map_err(|e| e.to_string())?;
                    io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
                }
            }

            if !root_folder.is_empty() && root_folder != "java21" {
                let old_dir = extract_dest.join(&root_folder);
                if old_dir.exists() {
                    let _ = fs::rename(old_dir, &runtime_dir);
                }
            }
        }
        let _ = fs::remove_file(temp_zip);
    }

    // ─── Phase 1: Locate and Download Vanilla Version Details ───
    let _ = app.emit("launch-progress", ProgressPayload {
        progress_type: "fabric".to_string(),
        task: 10,
        total: 100,
        message: "Locating Minecraft assets...".to_string(),
    });

    let version_manifest_url = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
    let manifest_res = client.get(version_manifest_url).send().await.map_err(|e| e.to_string())?.json::<Value>().await.map_err(|e| e.to_string())?;
    
    let versions = manifest_res["versions"].as_array().ok_or("Invalid manifest")?;
    let version_entry = versions.iter().find(|v| v["id"].as_str() == Some(mc_version)).ok_or("Minecraft version not found")?;
    let version_url = version_entry["url"].as_str().ok_or("Missing package URL")?;

    let version_detail: Value = client.get(version_url).send().await.map_err(|e| e.to_string())?.json().await.map_err(|e| e.to_string())?;
    
    // Save version.json
    let version_json_dir = mc_path.join("versions").join(mc_version);
    fs::create_dir_all(&version_json_dir).map_err(|e| e.to_string())?;
    fs::write(version_json_dir.join(format!("{}.json", mc_version)), version_detail.to_string()).map_err(|e| e.to_string())?;

    // Download Minecraft Client Jar
    let client_jar_url = version_detail["downloads"]["client"]["url"].as_str().ok_or("Missing client download URL")?;
    let client_jar_path = version_json_dir.join(format!("{}.jar", mc_version));
    if !client_jar_path.exists() {
        download_file_with_progress(&app, &client, client_jar_url, &client_jar_path, "game", 1, 1).await?;
    }

    // Download Vanilla Minecraft Libraries in Parallel
    if let Some(libraries) = version_detail["libraries"].as_array() {
        let total_libs = libraries.len() as u64;
        let current_lib = Arc::new(Mutex::new(0));
        let mut tasks = Vec::new();
        let semaphore = Arc::new(tokio::sync::Semaphore::new(12)); // 12 concurrent download threads

        for lib in libraries.clone() {
            let app = app.clone();
            let client = client.clone();
            let mc_path = mc_path.clone();
            let current_lib = current_lib.clone();
            let sem = semaphore.clone();

            tasks.push(tokio::spawn(async move {
                let _permit = sem.acquire().await.unwrap();
                let mut count = 0;
                {
                    let mut guard = current_lib.lock().unwrap();
                    *guard += 1;
                    count = *guard;
                }

                if let Some(rules) = lib.get("rules") {
                    if !is_library_allowed(rules) {
                        return;
                    }
                }

                let mut artifacts = Vec::new();
                if let Some(artifact) = lib["downloads"]["artifact"].as_object() {
                    artifacts.push(artifact.clone());
                }
                if let Some(classifiers) = lib["downloads"]["classifiers"].as_object() {
                    let key = if cfg!(target_os = "windows") {
                        "natives-windows"
                    } else if cfg!(target_os = "macos") {
                        "natives-macos"
                    } else {
                        "natives-linux"
                    };
                    if let Some(native_artifact) = classifiers.get(key) {
                        if let Some(native_obj) = native_artifact.as_object() {
                            artifacts.push(native_obj.clone());
                        }
                    }
                }

                for artifact in artifacts {
                    let url = artifact.get("url").and_then(|v| v.as_str()).unwrap_or("");
                    let path_str = artifact.get("path").and_then(|v| v.as_str()).unwrap_or("");
                    
                    if !url.is_empty() && !path_str.is_empty() {
                        let dest_path = mc_path.join("libraries").join(path_str);
                        if !dest_path.exists() {
                            if let Some(parent) = dest_path.parent() {
                                let _ = fs::create_dir_all(parent);
                            }
                            let _ = app.emit("launch-progress", serde_json::json!({
                                "type": "game",
                                "task": count,
                                "total": total_libs,
                                "message": format!("Library [{}/{}]: {}", count, total_libs, path_str),
                                "pct": (count * 100) / total_libs
                            }));
                            let _ = download_file_with_progress(&app, &client, url, &dest_path, "game", count, total_libs).await;
                        }
                    }
                }
            }));
        }
        for task in tasks {
            let _ = task.await;
        }
    }

    // Download Minecraft Asset Index & Object Files in Parallel
    if let Some(asset_index) = version_detail.get("assetIndex") {
        let index_url = asset_index["url"].as_str().unwrap_or("");
        let index_id = asset_index["id"].as_str().unwrap_or("1.21");
        
        if !index_url.is_empty() {
            let index_path = mc_path.join("assets").join("indexes").join(format!("{}.json", index_id));
            if let Some(parent) = index_path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            
            let _ = app.emit("launch-progress", serde_json::json!({
                "type": "game",
                "task": 0,
                "total": 100,
                "message": "Downloading Minecraft asset index...".to_string(),
                "pct": 0
            }));

            if let Ok(resp) = client.get(index_url).send().await {
                if let Ok(bytes) = resp.bytes().await {
                    let _ = fs::write(&index_path, &bytes);
                }
            }

            if let Ok(index_file) = File::open(&index_path) {
                if let Ok(index_data) = serde_json::from_reader::<_, Value>(index_file) {
                    if let Some(objects) = index_data["objects"].as_object() {
                        let total_assets = objects.len() as u64;
                        let current_asset = Arc::new(Mutex::new(0));
                        let mut asset_tasks = Vec::new();
                        let sem = Arc::new(tokio::sync::Semaphore::new(25)); // 25 concurrent downloads for speed

                        let objects_vec: Vec<(String, Value)> = objects.iter().map(|(k, v)| (k.clone(), v.clone())).collect();

                        for (key, obj) in objects_vec {
                            let app = app.clone();
                            let client = client.clone();
                            let mc_path = mc_path.clone();
                            let current_asset = current_asset.clone();
                            let sem = sem.clone();
                            
                            asset_tasks.push(tokio::spawn(async move {
                                let _permit = sem.acquire().await.unwrap();
                                let mut count = 0;
                                {
                                    let mut guard = current_asset.lock().unwrap();
                                    *guard += 1;
                                    count = *guard;
                                }

                                if let Some(hash) = obj["hash"].as_str() {
                                    let file_size = obj["size"].as_u64().unwrap_or(0);
                                    if hash.len() >= 2 {
                                        let prefix = &hash[0..2];
                                        let dest_path = mc_path.join("assets").join("objects").join(prefix).join(hash);
                                        
                                        if dest_path.exists() {
                                            if let Ok(meta) = fs::metadata(&dest_path) {
                                                if meta.len() == file_size {
                                                    return;
                                                }
                                            }
                                        }

                                        if let Some(parent) = dest_path.parent() {
                                            let _ = fs::create_dir_all(parent);
                                        }

                                        let url = format!("https://resources.download.minecraft.net/{}/{}", prefix, hash);
                                        
                                        if count % 50 == 0 || count == total_assets {
                                            let _ = app.emit("launch-progress", serde_json::json!({
                                                "type": "game",
                                                "task": count,
                                                "total": total_assets,
                                                "message": format!("Assets [{}/{}]: {}", count, total_assets, key),
                                                "pct": (count * 100) / total_assets
                                            }));
                                        }

                                        let _ = download_file_with_progress(&app, &client, &url, &dest_path, "game", count, total_assets).await;
                                    }
                                }
                            }));
                        }

                        for task in asset_tasks {
                            let _ = task.await;
                        }
                    }
                }
            }
        }
    }

    // Sync modpack if URL is provided
    if !zip_url.is_empty() {
        sync_mods_rust(app.clone(), zip_url.to_string()).await?;
    }

    // Download/Install Fabric Loader Profile
    let _ = app.emit("launch-progress", ProgressPayload {
        progress_type: "fabric".to_string(),
        task: 70,
        total: 100,
        message: "Fetching Fabric loader...".to_string(),
    });

    let fabric_meta_url = format!("https://meta.fabricmc.net/v2/versions/loader/{}", mc_version);
    if let Ok(loader_res) = client.get(&fabric_meta_url).send().await {
        if let Ok(loaders) = loader_res.json::<Value>().await {
            if let Some(latest_loader) = loaders.as_array().and_then(|a| a.first()) {
                let loader_version = latest_loader["loader"]["version"].as_str().unwrap_or("0.16.0");
                let fabric_id = format!("fabric-loader-{}-{}", loader_version, mc_version);

                let profile_url = format!("https://meta.fabricmc.net/v2/versions/loader/{}/{}/profile/json", mc_version, loader_version);
                if let Ok(profile_res) = client.get(&profile_url).send().await {
                    if let Ok(profile_json) = profile_res.json::<Value>().await {
                        let fabric_version_dir = mc_path.join("versions").join(&fabric_id);
                        fs::create_dir_all(&fabric_version_dir).map_err(|e| e.to_string())?;
                        fs::write(fabric_version_dir.join(format!("{}.json", fabric_id)), profile_json.to_string()).map_err(|e| e.to_string())?;

                        // Download Fabric dependencies (libraries)
                        if let Some(libraries) = profile_json["libraries"].as_array() {
                            let total_libs = libraries.len() as u64;
                            let mut current_lib = 0;
                            for lib in libraries {
                                current_lib += 1;
                                let name = lib["name"].as_str().unwrap_or("");
                                let url_base = lib["url"].as_str().unwrap_or("https://maven.fabricmc.net/");
                                
                                let parts: Vec<&str> = name.split(':').collect();
                                if parts.len() >= 3 {
                                    let group = parts[0].replace('.', "/");
                                    let artifact = parts[1];
                                    let version = parts[2];
                                    let file_name = format!("{}-{}.jar", artifact, version);
                                    let lib_rel_path = format!("{}/{}/{}/{}", group, artifact, version, file_name);
                                    
                                    let lib_dest_path = mc_path.join("libraries").join(&lib_rel_path);
                                    if !lib_dest_path.exists() {
                                        let lib_url = format!("{}{}", url_base, lib_rel_path);
                                        if let Some(p) = lib_dest_path.parent() {
                                            let _ = fs::create_dir_all(p);
                                        }
                                        let _ = download_file_with_progress(&app, &client, &lib_url, &lib_dest_path, "fabric", current_lib, total_libs).await;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let _ = app.emit("launch-progress", ProgressPayload {
        progress_type: "game".to_string(),
        task: 100,
        total: 100,
        message: "Assets loaded successfully!".to_string(),
    });

    Ok(true)
}

// ─── Module 3: JVM Classpath Construction & Spawn ───
pub fn launch_game_rust(app: AppHandle, _options: Value) -> Result<bool, String> {
    let data_dir = dirs::data_dir().ok_or("Failed to get data dir")?;
    let mc_path = data_dir.join("ZextaProject").join("game");
    let mc_version = _options["version"].as_str().unwrap_or("1.21.1");
    let max_memory = _options["maxMemory"].as_str().unwrap_or("4G");

    // Discover local java executable (Prioritize Adoptium Temurin runtime)
    let runtime_dir = mc_path.parent().unwrap().join("runtime").join("java21");
    let local_java_exe = if cfg!(target_os = "windows") {
        runtime_dir.join("bin").join("java.exe")
    } else {
        runtime_dir.join("bin").join("java")
    };

    let java_exe = if local_java_exe.exists() {
        local_java_exe.to_string_lossy().to_string()
    } else if cfg!(target_os = "windows") {
        "java.exe".to_string()
    } else {
        "java".to_string()
    };

    let fabric_id = fs::read_dir(mc_path.join("versions"))
        .map_err(|e| e.to_string())?
        .flatten()
        .find(|entry| {
            entry.file_name().to_str().map_or(false, |s| s.contains("fabric-loader"))
        })
        .map(|entry| entry.file_name().to_str().unwrap().to_string())
        .unwrap_or(mc_version.to_string());

    let version_json_path = mc_path.join("versions").join(&fabric_id).join(format!("{}.json", fabric_id));
    if !version_json_path.exists() {
        return Err("Launch configuration not found. Please sync files first.".to_string());
    }

    let version_data: Value = serde_json::from_reader(File::open(version_json_path).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    
    let mut classpath_elements = Vec::new();

    let libs_dir = mc_path.join("libraries");
    fn scan_jars(dir: &Path, elements: &mut Vec<String>) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    scan_jars(&path, elements);
                } else if path.extension().map_or(false, |ext| ext == "jar") {
                    elements.push(path.to_string_lossy().to_string());
                }
            }
        }
    }
    scan_jars(&libs_dir, &mut classpath_elements);

    let client_jar = mc_path.join("versions").join(mc_version).join(format!("{}.jar", mc_version));
    if client_jar.exists() {
        classpath_elements.push(client_jar.to_string_lossy().to_string());
    }

    let separator = if cfg!(target_os = "windows") { ";" } else { ":" };
    let classpath = classpath_elements.join(separator);

    let main_class = version_data["mainClass"].as_str().unwrap_or("net.minecraft.client.main.Main").to_string();

    let mut args = Vec::new();
    args.push(format!("-Xmx{}", max_memory));
    
    // JVM Performance & GC Optimizations for Minecraft
    args.push("-XX:+UseG1GC".to_string());
    args.push("-XX:+UnlockExperimentalVMOptions".to_string());
    args.push("-XX:G1NewSizePercent=20".to_string());
    args.push("-XX:G1ReservePercent=20".to_string());
    args.push("-XX:MaxGCPauseMillis=50".to_string());
    args.push("-XX:G1HeapRegionSize=32m".to_string());
    args.push("-XX:+ParallelRefProcEnabled".to_string());
    args.push("-XX:+UseStringDeduplication".to_string());

    args.push(format!("-Djava.library.path={}", mc_path.join("natives").to_string_lossy()));
    args.push("-cp".to_string());
    args.push(classpath);
    args.push(main_class);

    args.push("--username".to_string());
    args.push(_options["profile"]["name"].as_str().unwrap_or("Player").to_string());
    args.push("--version".to_string());
    args.push(mc_version.to_string());
    args.push("--gameDir".to_string());
    args.push(mc_path.to_string_lossy().to_string());
    args.push("--assetsDir".to_string());
    args.push(mc_path.join("assets").to_string_lossy().to_string());
    let asset_index_id = version_data["assetIndex"]["id"].as_str()
        .or(version_data["assets"].as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            if let Some(inherits_from) = version_data["inheritsFrom"].as_str() {
                let parent_json_path = mc_path.join("versions").join(inherits_from).join(format!("{}.json", inherits_from));
                if parent_json_path.exists() {
                    if let Ok(parent_file) = File::open(parent_json_path) {
                        if let Ok(parent_data) = serde_json::from_reader::<_, Value>(parent_file) {
                            if let Some(id) = parent_data["assetIndex"]["id"].as_str().or(parent_data["assets"].as_str()) {
                                return id.to_string();
                            }
                        }
                    }
                }
            }
            "17".to_string()
        });
    args.push("--assetIndex".to_string());
    args.push(asset_index_id);
    args.push("--uuid".to_string());
    args.push(_options["profile"]["id"].as_str().unwrap_or("00000000000000000000000000000000").to_string());
    args.push("--accessToken".to_string());
    args.push(_options["profile"]["token"].as_str().unwrap_or("null").to_string());
    args.push("--userType".to_string());
    args.push("msa".to_string());

    println!("[Launcher] Spawning Minecraft java process...");
    
    let _ = app.emit("launch-progress", serde_json::json!({
        "type": "game",
        "task": 100,
        "total": 100,
        "message": "Starting Java Virtual Machine (G1GC)...".to_string(),
        "pct": 100
    }));

    let child = Command::new(java_exe)
        .args(&args)
        .current_dir(&mc_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn();

    match child {
        Ok(mut c) => {
            let stdout = c.stdout.take();
            let stderr = c.stderr.take();

            let mut guard = ACTIVE_GAME_PROCESS.lock().unwrap();
            *guard = Some(c);
            drop(guard);

            // Real-time Stdout logger
            if let Some(out) = stdout {
                let app_handle_log = app.clone();
                std::thread::spawn(move || {
                    use std::io::{BufRead, BufReader};
                    let reader = BufReader::new(out);
                    for line in reader.lines().flatten() {
                        let _ = app_handle_log.emit("game-log", line);
                    }
                });
            }

            // Real-time Stderr logger
            if let Some(err) = stderr {
                let app_handle_log = app.clone();
                std::thread::spawn(move || {
                    use std::io::{BufRead, BufReader};
                    let reader = BufReader::new(err);
                    for line in reader.lines().flatten() {
                        let _ = app_handle_log.emit("game-log", line);
                    }
                });
            }

            let app_handle_clone = app.clone();
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(std::time::Duration::from_millis(500));
                    let mut guard = ACTIVE_GAME_PROCESS.lock().unwrap();
                    if let Some(ref mut child) = *guard {
                        match child.try_wait() {
                            Ok(Some(status)) => {
                                println!("[Launcher] Game process finished with status: {:?}", status);
                                *guard = None;
                                let _ = app_handle_clone.emit("game-closed", 0);
                                break;
                            }
                            Ok(None) => {}
                            Err(e) => {
                                println!("[Launcher] Error waiting for game process: {:?}", e);
                                *guard = None;
                                let _ = app_handle_clone.emit("game-closed", 0);
                                break;
                            }
                        }
                    } else {
                        let _ = app_handle_clone.emit("game-closed", 0);
                        break;
                    }
                }
            });
            Ok(true)
        }
        Err(e) => Err(format!("Failed to start JVM process: {}. Please make sure Java 21 is installed and in your system PATH.", e)),
    }
}

pub fn kill_game_rust() -> Result<bool, String> {
    let mut guard = ACTIVE_GAME_PROCESS.lock().unwrap();
    if let Some(mut child) = guard.take() {
        let _ = child.kill();
        Ok(true)
    } else {
        Ok(false)
    }
}
