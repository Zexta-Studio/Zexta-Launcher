use std::fs;
use std::sync::LazyLock;
use tauri::{AppHandle, Manager, WebviewWindowBuilder, WebviewUrl};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

mod launcher;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteConfig {
  pub project_name: String,
  pub logo_url: String,
  pub version: String,
  pub build_hash: String,
  pub server_ip: String,
  pub modpack_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStatus {
  pub online: bool,
  pub players: Option<ServerPlayers>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerPlayers {
  pub online: u32,
  pub max: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McProfile {
  pub id: String,
  pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginResult {
  pub success: bool,
  pub profile: McProfile,
  pub token: String,
  pub save_data: serde_json::Value,
  pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct XblResponse {
  Token: String,
  DisplayClaims: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct XstsResponse {
  Token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct McAuthResponse {
  access_token: String,
}

static REMOTE_CONFIG: LazyLock<Mutex<Option<RemoteConfig>>> = LazyLock::new(|| Mutex::new(None));
const XBOX_CLIENT_ID: &str = "000000004c12ae3f";

#[tauri::command]
async fn get_remote_config() -> Result<RemoteConfig, String> {
  let config = REMOTE_CONFIG.lock().unwrap().clone();
  if let Some(c) = config { return Ok(c); }

  let urls = vec![
    "https://raw.githubusercontent.com/phumitchreal/Frontline-Project/main/launcher_config.json".to_string(),
  ];
  for url in urls {
    if let Ok(resp) = reqwest::get(&url).await {
      if let Ok(data) = resp.json::<serde_json::Value>().await {
        let project_name = data["PROJECT_NAME"].as_str().unwrap_or("Zexta Project").to_string();
        let logo_url = data["LOGO_URL"].as_str().unwrap_or("/zexta-logo.png").to_string();
        let version = data["VERSION"].as_str().unwrap_or("2.5.0").to_string();
        let build_hash = data["BUILD_HASH"].as_str().unwrap_or("latest").to_string();
        let server_ip = data["SERVER_IP"].as_str().unwrap_or("").to_string();
        let modpack_url = data["MODPACK_URL"].as_str().unwrap_or("").to_string();
        let rc = RemoteConfig { project_name, logo_url, version, build_hash, server_ip, modpack_url };
        *REMOTE_CONFIG.lock().unwrap() = Some(rc.clone());
        return Ok(rc);
      }
    }
  }

  Ok(RemoteConfig {
    project_name: "Zexta Project".to_string(),
    logo_url: "/zexta-logo.png".to_string(),
    version: "2.5.0".to_string(),
    build_hash: "latest".to_string(),
    server_ip: "memory-ears.gl.joinmc.link".to_string(),
    modpack_url: "".to_string(),
  })
}

#[tauri::command]
async fn get_server_status(ip: String, _app: AppHandle) -> Result<ServerStatus, String> {
  let clean_ip = ip.trim();
  if clean_ip.is_empty() { return Ok(ServerStatus { online: false, players: None }); }

  if let Ok(resp) = reqwest::get(format!("https://api.mcstatus.io/v2/status/java/{}", clean_ip)).await {
    if let Ok(data) = resp.json::<serde_json::Value>().await {
      if data["online"].as_bool().unwrap_or(false) {
        let online = data["players"]["online"].as_u64().unwrap_or(0) as u32;
        let max = data["players"]["max"].as_u64().unwrap_or(0) as u32;
        return Ok(ServerStatus { online: true, players: Some(ServerPlayers { online, max }) });
      }
    }
  }
  Ok(ServerStatus { online: false, players: None })
}

#[tauri::command]
fn reset_launcher_data(_app: AppHandle) -> Result<bool, String> {
  let data_dir = dirs::data_dir().ok_or("Failed to get data dir".to_string())?;
  let mc_path = data_dir.join("ZextaProject").join("game");
  if mc_path.exists() {
    if let Err(e) = fs::remove_dir_all(&mc_path) {
      eprintln!("[Reset] Failed to remove game dir: {}", e);
    }
  }
  Ok(true)
}

#[tauri::command]
async fn sync_mods(app: AppHandle, zip_url: String) -> Result<bool, String> {
  launcher::sync_mods_rust(app, zip_url).await
}

#[tauri::command]
async fn prepare_game(app: AppHandle, options: serde_json::Value) -> Result<bool, String> {
  launcher::prepare_game_rust(app, options).await
}

#[tauri::command]
async fn launch_game(app: AppHandle, options: serde_json::Value) -> Result<bool, String> {
  launcher::launch_game_rust(app, options)
}

#[tauri::command]
fn kill_game(_app: AppHandle) -> Result<bool, String> {
  launcher::kill_game_rust()
}

#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
  open::that(url).map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
fn window_action(app: AppHandle, action: String) -> Result<(), String> {
  let window = app.get_webview_window("main")
    .ok_or("Window not found".to_string())?;
  match action.as_str() {
    "minimize" => window.minimize().map_err(|e| e.to_string()),
    "close" => window.close().map_err(|e| e.to_string()),
    _ => Err(format!("Unknown action: {}", action)),
  }
}

#[tauri::command]
async fn login_microsoft(app: AppHandle) -> Result<LoginResult, String> {
  eprintln!("[Login] Starting Microsoft login...");

  const REDIRECT_URI: &str = "https://login.live.com/oauth20_desktop.srf";
  const MC_CLIENT_ID: &str = "00000000402b5328";

  let auth_url = match url::Url::parse_with_params(
    "https://login.live.com/oauth20_authorize.srf",
    &[
      ("client_id", MC_CLIENT_ID),
      ("redirect_uri", REDIRECT_URI),
      ("response_type", "code"),
      ("scope", "XboxLive.signin offline_access"),
      ("prompt", "login"),
    ],
  ) {
    Ok(u) => u,
    Err(e) => return Err(format!("Failed to build auth URL: {}", e)),
  };

  let (code_tx, code_rx) = std::sync::mpsc::channel::<String>();
  let code_tx_clone = code_tx.clone();

  let login_popup = WebviewWindowBuilder::new(
    &app,
    "login-popup",
    WebviewUrl::External(auth_url),
  )
  .on_navigation(move |url| {
    let url_str = url.as_str();
    eprintln!("[Login-nav] URL: {}", url_str);
    if url_str.contains("code=") && url_str.contains("login.live.com") {
      if let Ok(parsed) = url::Url::parse(url_str) {
        for (key, val) in parsed.query_pairs() {
          if key == "code" && !val.is_empty() {
            eprintln!("[Login-nav] Extracted code!");
            let _ = code_tx_clone.send(val.into_owned());
            return false;
          }
        }
      }
    }
    true
  })
  .always_on_top(true)
  .decorations(false)
  .inner_size(420.0, 580.0)
  .center()
  .build()
  .map_err(|e| format!("Failed to create login window: {}", e))?;

  eprintln!("[Login] Waiting for user login (timeout 5 min)...");

  let code = match code_rx.recv_timeout(std::time::Duration::from_secs(300)) {
    Ok(c) => c,
    Err(_) => {
      let _ = login_popup.close();
      return Ok(LoginResult {
        success: false,
        profile: McProfile { id: "".into(), name: "".into() },
        token: "".into(),
        save_data: serde_json::json!({}),
        error: Some("Login timeout (5 min). Please try again.".into()),
      });
    }
  };

  let _ = login_popup.close();
  eprintln!("[Login] Got auth code, exchanging for token...");

  let client = reqwest::Client::builder()
    .timeout(std::time::Duration::from_secs(30))
    .build()
    .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

  eprintln!("[Login] Exchanging code for token at login.live.com...");
  let token_data = match client
    .post("https://login.live.com/oauth20_token.srf")
    .form(&[
      ("client_id", MC_CLIENT_ID),
      ("code", &code),
      ("grant_type", "authorization_code"),
      ("redirect_uri", REDIRECT_URI),
    ])
    .send()
    .await
  {
    Ok(r) => {
      eprintln!("[Login] Token status: {}", r.status());
      if !r.status().is_success() {
        let text = r.text().await.unwrap_or_default();
        eprintln!("[Login] Token error body: {}", &text[..500.min(text.len())]);
        return Ok(LoginResult {
          success: false,
          profile: McProfile { id: "".into(), name: "".into() },
          token: "".into(),
          save_data: serde_json::json!({}),
          error: Some(format!("Token rejected: {}", &text[..200.min(text.len())])),
        });
      }
      match r.json::<serde_json::Value>().await {
        Ok(d) => d,
        Err(e) => {
          eprintln!("[Login] Token JSON error: {}", e);
          return Ok(LoginResult {
            success: false,
            profile: McProfile { id: "".into(), name: "".into() },
            token: "".into(),
            save_data: serde_json::json!({}),
            error: Some(format!("Token parse error: {}", e)),
          });
        }
      }
    },
    Err(e) => {
      eprintln!("[Login] Token HTTP error: {}", e);
      return Ok(LoginResult {
        success: false,
        profile: McProfile { id: "".into(), name: "".into() },
        token: "".into(),
        save_data: serde_json::json!({}),
        error: Some(format!("Token exchange failed: {}", e)),
      });
    }
  };

  let access_token = match token_data["access_token"].as_str() {
    Some(t) if !t.is_empty() => t.to_string(),
    _ => {
      let err = token_data["error_description"].as_str().unwrap_or("No access_token").to_string();
      return Ok(LoginResult {
        success: false,
        profile: McProfile { id: "".into(), name: "".into() },
        token: "".into(),
        save_data: serde_json::json!({}),
        error: Some(err),
      });
    }
  };
  let refresh_token = token_data["refresh_token"].as_str().unwrap_or("").to_string();
  eprintln!("[Login] Got MS token: {}...", &access_token[..8.min(access_token.len())]);

  // Xbox Live auth
  eprintln!("[Login] Requesting XBL token...");
  let xbl_resp = match client
    .post("https://user.auth.xboxlive.com/user/authenticate")
    .json(&serde_json::json!({
      "Properties": {
        "AuthMethod": "RPS",
        "SiteName": "user.auth.xboxlive.com",
        "RpsTicket": format!("d={}", access_token)
      },
      "RelyingParty": "http://auth.xboxlive.com",
      "TokenType": "JWT"
    }))
    .send()
    .await
  {
    Ok(r) => {
      eprintln!("[Login] XBL status: {}", r.status());
      if !r.status().is_success() {
        let text = r.text().await.unwrap_or_default();
        eprintln!("[Login] XBL error body: {}", &text[..200.min(text.len())]);
        return Ok(LoginResult {
          success: false,
          profile: McProfile { id: "".into(), name: "".into() },
          token: "".into(),
          save_data: serde_json::json!({"refresh_token": refresh_token}),
          error: Some(format!("XBL rejected: {}", &text[..100.min(text.len())])),
        });
      }
      match r.json::<serde_json::Value>().await {
        Ok(v) => v,
        Err(e) => {
          eprintln!("[Login] XBL JSON error: {}", e);
          return Ok(LoginResult {
            success: false,
            profile: McProfile { id: "".into(), name: "".into() },
            token: "".into(),
            save_data: serde_json::json!({"refresh_token": refresh_token}),
            error: Some(format!("XBL auth error: {}", e)),
          });
        }
      }
    },
    Err(e) => {
      eprintln!("[Login] XBL HTTP error: {}", e);
      return Ok(LoginResult {
        success: false,
        profile: McProfile { id: "".into(), name: "".into() },
        token: "".into(),
        save_data: serde_json::json!({"refresh_token": refresh_token}),
        error: Some(format!("XBL auth failed: {}", e)),
      });
    }
  };

  let xbl_token = xbl_resp["Token"].as_str().unwrap_or("").to_string();
  let uhs = xbl_resp["DisplayClaims"]["xui"][0]["uhs"].as_str().unwrap_or("").to_string();

  if xbl_token.is_empty() || uhs.is_empty() {
    eprintln!("[Login] XBL response missing Token/uhs: {:?}", xbl_resp);
    return Ok(LoginResult {
      success: false,
      profile: McProfile { id: "".into(), name: "".into() },
      token: "".into(),
      save_data: serde_json::json!({"refresh_token": refresh_token}),
      error: Some("XBL did not return a valid token.".into()),
    });
  }
  eprintln!("[Login] XBL token: {}...", &xbl_token[..8.min(xbl_token.len())]);

  // XSTS
  eprintln!("[Login] Requesting XSTS...");
  let xsts_body = serde_json::json!({
    "Properties": {
      "SandboxId": "RETAIL",
      "UserTokens": [xbl_token]
    },
    "RelyingParty": "rp://api.minecraftservices.com/",
    "TokenType": "JWT"
  });
  eprintln!("[Login] XSTS body: {}", serde_json::to_string(&xsts_body).unwrap_or_default());
  let xsts_client = reqwest::Client::new();
  let xsts_resp = match xsts_client
    .post("https://xsts.auth.xboxlive.com/xsts/authorize")
    .header("Content-Type", "application/json")
    .header("Accept", "application/json")
    .json(&xsts_body)
    .send()
    .await
  {
    Ok(r) => {
      eprintln!("[Login] XSTS status: {}", r.status());
      let text = r.text().await.unwrap_or_default();
      eprintln!("[Login] XSTS body: {}", &text[..500.min(text.len())]);
      match serde_json::from_str::<serde_json::Value>(&text) {
        Ok(v) => {
          if let Some(xerr) = v.get("XErr").and_then(|e| e.as_i64()) {
            let msg = match xerr {
              2148916233 => "The account doesn't have Xbox Live or Minecraft.".into(),
              2148916235 => "Xbox Live is not available in this country/region.".into(),
              2148916236 | 2148916237 => "The account needs parental consent.".into(),
              2148916238 => "The account is a child account and needs an adult.".into(),
              _ => format!("XSTS error code: {}", xerr),
            };
            eprintln!("[Login] XSTS error: {}", msg);
            return Ok(LoginResult {
              success: false,
              profile: McProfile { id: "".into(), name: "".into() },
              token: "".into(),
              save_data: serde_json::json!({"refresh_token": refresh_token}),
              error: Some(msg),
            });
          }
          v
        }
        Err(e) => {
          eprintln!("[Login] XSTS JSON error: {}", e);
          return Ok(LoginResult {
            success: false,
            profile: McProfile { id: "".into(), name: "".into() },
            token: "".into(),
            save_data: serde_json::json!({"refresh_token": refresh_token}),
            error: Some(format!("XSTS auth error: {}", e)),
          });
        }
      }
    },
    Err(e) => {
      eprintln!("[Login] XSTS HTTP error: {}", e);
      return Ok(LoginResult {
        success: false,
        profile: McProfile { id: "".into(), name: "".into() },
        token: "".into(),
        save_data: serde_json::json!({"refresh_token": refresh_token}),
        error: Some(format!("XSTS auth failed: {}", e)),
      });
    }
  };

  let xsts_token = xsts_resp["Token"].as_str().unwrap_or("").to_string();
  if xsts_token.is_empty() {
    eprintln!("[Login] XSTS response missing Token: {:?}", xsts_resp);
    return Ok(LoginResult {
      success: false,
      profile: McProfile { id: "".into(), name: "".into() },
      token: "".into(),
      save_data: serde_json::json!({"refresh_token": refresh_token}),
      error: Some("No XSTS token returned. Make sure you own Minecraft.".into()),
    });
  }
  eprintln!("[Login] XSTS token: {}...", &xsts_token[..8.min(xsts_token.len())]);

  // Minecraft auth
  eprintln!("[Login] Requesting MC auth...");
  let mc_resp = match client
    .post("https://api.minecraftservices.com/authentication/login_with_xbox")
    .json(&serde_json::json!({
      "identityToken": format!("XBL3.0 x={};{}", uhs, xsts_token)
    }))
    .send()
    .await
  {
    Ok(r) => {
      eprintln!("[Login] MC auth status: {}", r.status());
      if !r.status().is_success() {
        let text = r.text().await.unwrap_or_default();
        eprintln!("[Login] MC auth error body: {}", &text[..200.min(text.len())]);
        return Ok(LoginResult {
          success: false,
          profile: McProfile { id: "".into(), name: "".into() },
          token: "".into(),
          save_data: serde_json::json!({"refresh_token": refresh_token}),
          error: Some(format!("MC auth rejected: {}", &text[..100.min(text.len())])),
        });
      }
      match r.json::<serde_json::Value>().await {
        Ok(v) => v,
        Err(e) => {
          eprintln!("[Login] MC auth JSON error: {}", e);
          return Ok(LoginResult {
            success: false,
            profile: McProfile { id: "".into(), name: "".into() },
            token: "".into(),
            save_data: serde_json::json!({"refresh_token": refresh_token}),
            error: Some(format!("MC auth error: {}", e)),
          });
        }
      }
    },
    Err(e) => {
      eprintln!("[Login] MC auth HTTP error: {}", e);
      return Ok(LoginResult {
        success: false,
        profile: McProfile { id: "".into(), name: "".into() },
        token: "".into(),
        save_data: serde_json::json!({"refresh_token": refresh_token}),
        error: Some(format!("MC auth failed: {}", e)),
      });
    }
  };

  let mc_token = mc_resp["access_token"].as_str().unwrap_or("").to_string();
  if mc_token.is_empty() {
    eprintln!("[Login] MC auth response missing access_token: {:?}", mc_resp);
    return Ok(LoginResult {
      success: false,
      profile: McProfile { id: "".into(), name: "".into() },
      token: "".into(),
      save_data: serde_json::json!({"refresh_token": refresh_token}),
      error: Some("No Minecraft access_token.".into()),
    });
  }
  eprintln!("[Login] MC token: {}...", &mc_token[..8.min(mc_token.len())]);

  // Fetch Minecraft profile
  eprintln!("[Login] Fetching profile...");
  let profile_resp = match client
    .get("https://api.minecraftservices.com/minecraft/profile")
    .header("Authorization", format!("Bearer {}", mc_token))
    .send()
    .await
  {
    Ok(r) => {
      eprintln!("[Login] Profile status: {}", r.status());
      if !r.status().is_success() {
        let text = r.text().await.unwrap_or_default();
        eprintln!("[Login] Profile error body: {}", &text[..200.min(text.len())]);
        return Ok(LoginResult {
          success: false,
          profile: McProfile { id: "".into(), name: "".into() },
          token: mc_token,
          save_data: serde_json::json!({"refresh_token": refresh_token}),
          error: Some(format!("Profile rejected: {}", &text[..100.min(text.len())])),
        });
      }
      match r.json::<serde_json::Value>().await {
        Ok(v) => v,
        Err(e) => {
          eprintln!("[Login] Profile JSON error: {}", e);
          return Ok(LoginResult {
            success: false,
            profile: McProfile { id: "".into(), name: "".into() },
            token: mc_token,
            save_data: serde_json::json!({"refresh_token": refresh_token}),
            error: Some(format!("Profile fetch error: {}", e)),
          });
        }
      }
    },
    Err(e) => {
      eprintln!("[Login] Profile HTTP error: {}", e);
      return Ok(LoginResult {
        success: false,
        profile: McProfile { id: "".into(), name: "".into() },
        token: mc_token,
        save_data: serde_json::json!({"refresh_token": refresh_token}),
        error: Some(format!("Profile fetch failed: {}", e)),
      });
    }
  };

  let profile = McProfile {
    id: profile_resp["id"].as_str().unwrap_or("00000000-0000-0000-0000-000000000000").to_string(),
    name: profile_resp["name"].as_str().unwrap_or("Player").to_string(),
  };

  eprintln!("[Login] Success! Logged in as: {} ({})", profile.name, profile.id);

  Ok(LoginResult {
    success: true,
    profile,
    token: mc_token,
    save_data: serde_json::json!({"refresh_token": refresh_token}),
    error: None,
  })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .invoke_handler(tauri::generate_handler![
      get_remote_config,
      get_server_status,
      reset_launcher_data,
      sync_mods,
      prepare_game,
      launch_game,
      kill_game,
      open_external,
      window_action,
      login_microsoft,
    ])
    .setup(|_app| Ok(()))
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
