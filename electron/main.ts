import { app, BrowserWindow, ipcMain, shell, nativeImage, dialog, protocol, net } from 'electron'
import { join, resolve, dirname } from 'path'
import { pathToFileURL } from 'url'
import { Auth } from 'msmc'
import { Client } from 'minecraft-launcher-core'
import { installFabric, getFabricLoaderArtifact } from '@xmcl/installer'
import { MinecraftLocation } from '@xmcl/core'
import AdmZip from 'adm-zip'
import axios from 'axios'
import DiscordRPC from 'discord-rpc'
import os from 'os'
import crypto from 'crypto'
import fs from 'fs'

const isDev = process.env.VITE_DEV_SERVER_URL !== undefined;

// Rebrand Electron
app.name = 'Frontline Project Launcher';
if (process.platform === 'win32') {
  app.setAppUserModelId('com.frontline.launcher');
}

// Disable DevTools completely if not in dev mode
if (!isDev) {
  app.commandLine.appendSwitch('disable-devtools');
}

// Register custom protocol privileges
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-file', privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

const launcher = new Client()

// Helper to get machine fingerprint
function getMachineFingerprint() {
  const cpus = os.cpus().map(c => c.model).join(',');
  const totalMem = os.totalmem();
  const username = os.userInfo().username;
  const platform = os.platform();
  const data = `${cpus}-${totalMem}-${username}-${platform}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Preparer class to download assets without launching the game
class Preparer extends Client {
  private downloadFinished = false;

  constructor() {
    super();
    // Override startMinecraft to just set a flag and return a dummy process
    (this as any).startMinecraft = () => {
      this.downloadFinished = true;
      return {
        on: () => { },
        stdout: { on: () => { } },
        stderr: { on: () => { } },
        kill: () => { }
      } as any;
    };
  }

  async prepare(options: any) {
    this.downloadFinished = false;
    await this.launch(options);
    return this.downloadFinished;
  }
}

const preparer = new Preparer()
const msmc = new Auth("select_account")

// Get platform-specific icon path
function getIconPath(): string {
  const basePath = isDev
    ? resolve(process.cwd(), 'public')
    : resolve(app.getAppPath(), 'public');

  if (process.platform === 'darwin') {
    // macOS - try .icns first, fallback to .ico
    return resolve(basePath, 'favicon.icns');
  } else if (process.platform === 'linux') {
    // Linux - use .png or .ico
    return resolve(basePath, 'favicon.png');
  } else {
    // Windows
    return resolve(basePath, 'favicon.ico');
  }
}

const iconPath = getIconPath();

// Discord RPC Setup
const clientId = '1484021494026735767' // You should replace this with your real Discord Application ID
const rpc = new DiscordRPC.Client({ transport: 'ipc' })

let remoteConfig: any = {
  PROJECT_NAME: "Frontline Project",
  LOGO_URL: "https://raw.githubusercontent.com/phumitchreal/Frontline-Project/refs/heads/main/favicon.ico",
  RPC: {
    DETAILS: "Playing on Frontline Server",
    STATE: "Season 1: Initial",
    LARGE_IMAGE_KEY: "logo",
    LARGE_IMAGE_TEXT: "Frontline Project"
  },
  SOCIAL: {
    DISCORD: "https://discord.gg/frontline",
    WEBSITE: "https://frontline-project.com"
  },
  DISCORD_CLIENT_ID: "1484021494026735767"
};

async function fetchRemoteConfig() {
  const timestamp = Date.now();
  const urls = [
    `https://raw.githubusercontent.com/phumitchreal/Frontline-Project/main/launcher_config.json?t=${timestamp}`,
    `https://github.com/phumitchreal/Frontline-Project/raw/main/launcher_config.json?t=${timestamp}`
  ];
  
  for (const url of urls) {
    try {
      console.log(`[Main] Attempting to fetch Remote Config from: ${url}`);
      const response = await axios.get(url, { 
        timeout: 10000,
        responseType: 'text',
        transformResponse: [(data) => data]
      });
      
      const rawText = response.data;
      if (!rawText || typeof rawText !== 'string') continue;
      
      // Auto-Repair: ลบคอมม่าเกิน
      const sanitized = rawText.replace(/,\s*([\]}])/g, '$1');
      const parsed = JSON.parse(sanitized);
      
      remoteConfig = { ...remoteConfig, ...parsed };
      console.log(`[Main] Remote Config Success from: ${url} ✅ IP: ${remoteConfig.SERVER_IP}`);
      return; 
    } catch (e: any) {
      console.warn(`[Main] Failed to fetch from ${url}: ${e.message}`);
    }
  }
  console.error("[Main] All Remote Config sources failed.");
}

function setRPCActivity(details: string, state: string, username?: string) {
  try {
    const activity: any = {
      details: details || remoteConfig.RPC.DETAILS,
      state: state || remoteConfig.RPC.STATE,
      largeImageKey: remoteConfig.RPC?.LARGE_IMAGE_KEY || "logo2",
      largeImageText: remoteConfig.RPC?.LARGE_IMAGE_TEXT || remoteConfig.PROJECT_NAME,
      smallImageKey: username ? `https://mc-heads.net/avatar/${username}/64` : undefined,
      smallImageText: username,
      instance: false,
      startTimestamp: new Date(),
      buttons: [
        { label: "Discord", url: remoteConfig.SOCIAL.DISCORD },
        { label: "Website", url: remoteConfig.SOCIAL.WEBSITE }
      ]
    }
    rpc.setActivity(activity)
  } catch (e) {
    console.error("RPC Error:", e)
  }
}

rpc.on('ready', () => {
  setRPCActivity('Main Menu', 'Waiting for Login')
})

async function initRPC() {
  await fetchRemoteConfig();
  const cid = remoteConfig.DISCORD_CLIENT_ID || clientId;
  console.log(`[RPC] Initializing with Client ID: ${cid}`);
  rpc.login({ clientId: cid }).catch(e => console.error("RPC Login Error:", e));
}

initRPC();

let win: BrowserWindow | null = null
let gameProcess: any = null
let isPreparing: boolean = false

function createWindow() {
  // Create icon with fallback
  let icon: any = undefined;
  try {
    if (fs.existsSync(iconPath)) {
      icon = nativeImage.createFromPath(iconPath);
    } else {
      console.warn(`Icon not found at ${iconPath}, using default`);
      // Try fallback to ico format on all platforms
      const fallbackPath = resolve(isDev ? process.cwd() : app.getAppPath(), 'public/favicon.ico');
      if (fs.existsSync(fallbackPath)) {
        icon = nativeImage.createFromPath(fallbackPath);
      }
    }
  } catch (e) {
    console.error(`Failed to load icon: ${e}`);
    // Continue without icon
  }

  win = new BrowserWindow({
    width: 1100,
    height: 650,
    title: 'Frontline Project Launcher',
    frame: false,
    resizable: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: false, // บังคับปิด DevTools ในระดับลึก
    },
    show: false,
    backgroundColor: '#000000',
    transparent: false,
    opacity: 0,
    icon: icon,
  })

  // DevTools Protection: ปิดการเข้าถึงทุกกรณี
  const closeDevTools = () => {
    if (win?.webContents && win.webContents.isDevToolsOpened()) {
      win.webContents.closeDevTools();
    }
  };

  win.webContents.on('devtools-opened', closeDevTools);
  win.webContents.on('devtools-focused', closeDevTools);

  // ป้องกันการโหลดซ้ำหรือการกระทำใดๆ ที่มาจาก DevTools
  (win.webContents as any).on('devtools-reload-page', (e: any) => {
    e.preventDefault();
    closeDevTools();
  });

  // ป้องกันการกดคลิกขวาในระดับ Main Process
  win.webContents.on('context-menu', (e) => {
    e.preventDefault();
  });

  // บังคับเช็คทุกๆ 200ms เพื่อความชัวร์ (Aggressive มากขึ้น)
  const devToolsInterval = setInterval(closeDevTools, 200);

  win.on('closed', () => {
    clearInterval(devToolsInterval);
    win = null;
  });

  win.webContents.on('before-input-event', (event, input) => {
    // ป้องกัน F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
    const isControlShift = input.control && input.shift;
    const key = input.key.toLowerCase();

    if (
      input.key === 'F12' ||
      (isControlShift && (key === 'i' || key === 'j' || key === 'c')) ||
      (input.control && key === 'u') || // ป้องกัน View Source
      (input.control && key === 'r') || // ป้องกัน Refresh (Reload)
      (input.control && input.shift && key === 'r') // ป้องกัน Hard Reload
    ) {
      event.preventDefault();
      closeDevTools();
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(join(__dirname, '../dist/index.html'))
  }

  win.on('ready-to-show', () => {
    win?.show()
    // More smooth fade-in
    let opacity = 0
    const fadeIn = setInterval(() => {
      if (opacity >= 1) {
        clearInterval(fadeIn)
        win?.setOpacity(1)
      } else {
        opacity += 0.05 // Smaller steps for smoothness
        win?.setOpacity(opacity)
      }
    }, 16) // ~60fps
  })
}

app.whenReady().then(() => {
  // Register a custom protocol to serve local files
  protocol.handle('local-file', async (request) => {
    try {
      // ดึง URL และตัดเอาส่วนพาธออกมา
      const url = new URL(request.url);
      let p = '';

      if (process.platform === 'win32') {
        // บน Windows: host คือ drive letter (c:), pathname คือ /path/to/file
        p = decodeURIComponent(url.host + url.pathname);
        if (p.startsWith('/')) p = p.slice(1);
        p = p.replace(/\//g, '\\');
      } else {
        p = decodeURIComponent(url.pathname);
      }

      // ตัดเอาเฉพาะพาธไฟล์ ไม่เอา Query String
      p = p.split('?')[0];

      if (!fs.existsSync(p)) {
        console.error(`[Protocol] File not found: ${p}`);
        return new Response('Not Found', { status: 404 });
      }

      const data = await fs.promises.readFile(p);
      return new Response(data, {
        headers: {
          'Content-Type': 'image/png',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (e: any) {
      console.error('[Protocol Error]', e);
      return new Response(e.message, { status: 500 });
    }
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

ipcMain.on('open-external', (_, url: string) => {
  shell.openExternal(url);
});

ipcMain.on('window-controls', (_, action: 'minimize' | 'close') => {
  const window = BrowserWindow.getFocusedWindow()
  if (!window) return

  if (action === 'minimize') {
    window.minimize()
  } else if (action === 'close') {
    // Smoother fade-out
    let opacity = window.getOpacity()
    const fadeOut = setInterval(() => {
      if (opacity <= 0) {
        clearInterval(fadeOut)
        window.close()
      } else {
        opacity -= 0.05
        window.setOpacity(Math.max(0, opacity))
      }
    }, 16)
  }
})
ipcMain.handle('get-remote-config', () => {
  return remoteConfig;
});

ipcMain.handle('get-installer-language', async () => {
  try {
    const userData = app.getPath('userData');
    const langPath = join(userData, 'FrontlineProject', 'language.conf');

    if (fs.existsSync(langPath)) {
      const lang = fs.readFileSync(langPath, 'utf-8').trim();
      if (lang === 'TH' || lang === 'EN') {
        console.log(`[Lang] Installer language preference loaded: ${lang}`);
        return lang;
      }
    }
  } catch (e) {
    console.warn('[Lang] Failed to read installer language preference:', e);
  }
  return null;
});

ipcMain.handle('get-server-status', async (_, frontendIp: string) => {
  // Use config from main if available, else fallback to frontend IP
  const ip = remoteConfig.SERVER_IP || frontendIp || 'play.yourserver.com';
  const cleanIp = (ip || '').trim();
  console.log(`[ServerStatus] Probing: "${cleanIp}"`);
  
  if (!cleanIp || cleanIp === 'play.yourserver.com') {
    console.warn(`[ServerStatus] ⚠️ Invalid or Fallback IP detected: "${cleanIp}"`);
    return { online: false };
  }
  
  try {
    // Attempt 1: mcstatus.io
    console.log(`[ServerStatus] Trying API: mcstatus.io for ${cleanIp}...`);
    const res = await axios.get(`https://api.mcstatus.io/v2/status/java/${cleanIp}`, { timeout: 4000 });
    if (res.data?.online) {
       console.log(`[ServerStatus] ✅ API mcstatus.io: ONLINE. Players: ${res.data.players?.online}/${res.data.players?.max}`);
       return {
         online: true,
         players: {
           online: res.data.players?.online || 0,
           max: res.data.players?.max || 0
         }
       };
    } else {
       console.log(`[ServerStatus] ❌ API mcstatus.io: OFFLINE (Response data marked offline)`);
    }
  } catch (e: any) {
    console.error(`[ServerStatus] ❌ API mcstatus.io Failed: ${e.message}`);
  }

  // Attempt 2: Direct Socket Probe (Port 25565)
  try {
    const net = require('net');
    console.log(`[ServerStatus] Trying Direct Socket Probe: ${cleanIp}:25565...`);
    const isUp = await new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(4000); // 4 seconds timeout
      socket.on('connect', () => { 
        socket.destroy(); 
        console.log(`[ServerStatus] ✅ Socket connected successfully to ${cleanIp}:25565`);
        resolve(true); 
      });
      socket.on('timeout', () => { 
        socket.destroy(); 
        console.log(`[ServerStatus] ❌ Socket Connection Timeout`);
        resolve(false); 
      });
      socket.on('error', (err: any) => { 
        console.log(`[ServerStatus] ❌ Socket Error: ${err.message}`);
        resolve(false); 
      });
      socket.connect(25565, cleanIp);
    });
    
    if (isUp) {
      return { online: true, players: { online: '?', max: '?' } };
    }
  } catch (e: any) {
    console.error(`[ServerStatus] ❌ Socket Check Exception: ${e.message}`);
  }
  
  console.log(`[ServerStatus] 💔 Overall Status for ${cleanIp}: OFFLINE`);
  return { online: false };
});

ipcMain.handle('open-file-selector', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }]
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('update-skin', async (_, accessToken: string, skinPath: string) => {
  try {
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('variant', 'slim');
    formData.append('file', fs.createReadStream(skinPath));

    console.log("Uploading skin to Mojang API...");
    const response = await axios.post('https://api.minecraftservices.com/minecraft/profile/skins', formData, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        ...formData.getHeaders()
      }
    });
    console.log("Skin update success:", response.data);
    return { success: true, data: response.data };
  } catch (err: any) {
    console.error("Skin Update Error Detail:", err.response?.data || err.message);
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Headers:", err.response.headers);
    }
    let errorMsg = "ไม่สามารถอัปโหลดสกินได้";
    if (err.response?.data?.errorMessage) {
      errorMsg = err.response.data.errorMessage;
    } else if (err.message) {
      errorMsg = err.message;
    }
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('get-mojang-profile', async (_, accessToken: string) => {
  try {
    console.log("Fetching profile from Mojang API...");
    const response = await axios.get('https://api.minecraftservices.com/minecraft/profile', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    console.log("Mojang profile fetch success:", response.data.name);
    return { success: true, profile: response.data };
  } catch (err: any) {
    console.error("Mojang Profile Fetch Error:", err.response?.data || err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('refresh-login', async (_, profile: any) => {
  try {
    console.log(`[Auth] Attempting auto-login for user: ${profile?.name || 'Unknown'}`);
    const msmcAuth = new Auth("select_account");

    // Update User-Agent for refresh as well
    const customUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
    app.userAgentFallback = customUserAgent;

    const xboxManager = await msmcAuth.refresh(profile);
    const mcToken = await xboxManager.getMinecraft();

    if (mcToken && mcToken.validate() && mcToken.profile) {
      console.log(`[Auth] Auto-login successful: ${mcToken.profile.name}`);
      setRPCActivity('Home Page', `Welcome back, ${mcToken.profile.name}`, mcToken.profile.name)
      return {
        success: true,
        profile: mcToken.profile,
        token: mcToken.mclc(),
        save_data: xboxManager.save() // Save the refreshable object
      }
    }
    console.warn("[Auth] Auto-login failed: mcToken invalid or no profile");
    return { success: false }
  } catch (err) {
    console.error("[Auth] Auto-login error:", err);
    return { success: false, error: String(err) }
  }
})

ipcMain.handle('reset-launcher-data', async () => {
  try {
    const mcPath = join(app.getPath('userData'), 'FrontlineProject', 'game')
    if (fs.existsSync(mcPath)) {
      fs.rmSync(mcPath, { recursive: true, force: true });
    }

    const { session } = require('electron');
    const loginSession = session.fromPartition('persist:microsoft_login');
    await loginSession.clearStorageData();
    await session.defaultSession.clearStorageData();

    return { success: true };
  } catch (err: any) {
    console.error("Reset Error:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('login-microsoft', async () => {
  try {
    console.log("Starting Microsoft Login with Manual Window...");
    const msmcAuth = new Auth("select_account");

    // Set a standard User-Agent globally and for the specific session to avoid being flagged by Microsoft
    const customUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0";
    app.userAgentFallback = customUserAgent;

    const { session } = require('electron');
    const loginSession = session.fromPartition('persist:microsoft_login');
    loginSession.setUserAgent(customUserAgent);

    // Clear cache to resolve verification issues if they were stuck
    // await loginSession.clearStorageData(); 

    const xboxManager = await msmcAuth.launch('electron', {
      width: 500,
      height: 650,
      title: "Microsoft Login",
      autoHideMenuBar: true,
      webPreferences: {
        partition: 'persist:microsoft_login',
        contextIsolation: true,
        nodeIntegration: false,
        allowRunningInsecureContent: true
      }
    } as any);

    if (!xboxManager) {
      throw new Error("Xbox Manager could not be initialized.");
    }

    console.log("Xbox login successful, getting Minecraft token...");
    const mcToken = await xboxManager.getMinecraft();

    if (mcToken && mcToken.validate() && mcToken.profile) {
      console.log("Minecraft token validated for user:", mcToken.profile.name);
      setRPCActivity('Home Page', `Logged in as ${mcToken.profile.name}`, mcToken.profile.name)

      // msmc v4: we should save enough information to refresh later
      // Return both profile and the full refreshable object if needed
      return {
        success: true,
        profile: mcToken.profile,
        token: mcToken.mclc(),
        // This is often what msmc needs for refresh
        save_data: xboxManager.save()
      }
    } else {
      console.error("Minecraft validation failed. Account might not own the game.");
      return {
        success: false,
        error: 'บัญชีนี้ไม่มีเกม Minecraft แท้อยู่ในระบบ หรือการยืนยันตัวตนล้มเหลว'
      }
    }
  } catch (err: any) {
    console.error("Detailed Login Error:", err);
    let errorMessage = 'เกิดข้อผิดพลาดในการเชื่อมต่อกับ Microsoft';

    if (err.message) {
      if (err.message.includes('closed')) errorMessage = 'หน้าต่างล็อกอินถูกปิดก่อนดำเนินการเสร็จ';
      else if (err.message.includes('timeout')) errorMessage = 'การเชื่อมต่อหมดเวลา โปรดลองใหม่อีกครั้ง';
      else if (err.message.includes('cancelled')) errorMessage = 'การล็อกอินถูกยกเลิก';
      else if (err.message.includes('verification')) errorMessage = 'Microsoft บล็อกการยืนยันตัวตนชั่วคราว (อาจติด Cooldown 24-48 ชม.)';
      else errorMessage = `ข้อผิดพลาด: ${err.message}`;
    }

    return { success: false, error: errorMessage }
  }
})

// Internal function to sync mods, can be called from IPC or internally
async function syncModsInternal(zipUrl: string, onProgress?: (current: number, total: number) => void) {
  const mcPath = join(app.getPath('userData'), 'FrontlineProject', 'game')
  const modsPath = join(mcPath, 'mods')

  // ✅ Clear old signature to prevent version mismatch (e.g. 0.18.4 fix)
  const signaturePath = join(mcPath, '.launcher_sig')
  if (fs.existsSync(signaturePath)) {
    try {
      fs.unlinkSync(signaturePath)
      console.log('[Sync] Old signature cleared')
    } catch (e) { }
  }

  if (!fs.existsSync(mcPath)) fs.mkdirSync(mcPath, { recursive: true })
  if (!fs.existsSync(modsPath)) fs.mkdirSync(modsPath, { recursive: true })

  const tempFile = join(app.getPath('temp'), zipUrl.endsWith('.mrpack') ? 'pack.mrpack' : 'frontline_mods.zip')

  console.log(`Downloading pack from: ${zipUrl}...`)
  const response = await axios.get(zipUrl, { responseType: 'arraybuffer' })
  fs.writeFileSync(tempFile, response.data)

  const zip = new AdmZip(tempFile)

  if (zipUrl.endsWith('.mrpack')) {
    console.log("Parsing Modrinth pack...")
    const indexEntry = zip.getEntry('modrinth.index.json')
    if (!indexEntry) throw new Error('Invalid .mrpack: modrinth.index.json not found')

    const index = JSON.parse(indexEntry.getData().toString('utf8'))
    console.log("[Sync] Pack index loaded. Dependencies:", JSON.stringify(index.dependencies));

    // Detect loaders
    let fabricVersion = index.dependencies?.fabric || index.dependencies?.['fabric-loader'];
    let minecraftVersion = index.dependencies?.minecraft;

    if (!fabricVersion) {
      console.log("[Sync] Fabric version not found in dependencies, checking files for fabric-loader...");
      // Check if any file in the index is a fabric loader file or if it's a fabric pack
      const isFabricPack = index.files.some((f: any) => f.path.toLowerCase().includes('fabric'));
      console.log(`[Sync] isFabricPack: ${isFabricPack} (Total files: ${index.files.length})`);
      if (isFabricPack) {
        console.log("[Sync] Detected Fabric mods, assuming latest Fabric for this MC version...");
        fabricVersion = "latest"; // Mark as latest to trigger installer
      }
    }

    // 1. Download mods from index
    let count = 0;
    const modFilesFromPack: string[] = [];

    for (const file of index.files) {
      count++;
      const destPath = join(mcPath, file.path)
      const destDir = join(destPath, '..')

      // Keep track of mods in this pack for cleaning later
      if (file.path.startsWith('mods/')) {
        modFilesFromPack.push(file.path.replace('mods/', ''));
      }

      // Skip if file already exists and size matches (basic check)
      if (fs.existsSync(destPath)) {
        const stats = fs.statSync(destPath);
        if (stats.size === file.fileSize) {
          console.log(`Skipping mod (already exists): ${file.path}`);
          if (onProgress) onProgress(count, index.files.length);
          continue;
        }
      }

      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })

      console.log(`Downloading mod: ${file.path}...`)
      if (onProgress) onProgress(count, index.files.length)
      const modResponse = await axios.get(file.downloads[0], { responseType: 'arraybuffer' })
      fs.writeFileSync(destPath, modResponse.data)
    }

    // 1.5. Clean Mods (Replace part): Remove mods NOT in this pack
    if (fs.existsSync(modsPath)) {
      console.log("[Sync] Cleaning mods folder...");
      const localMods = fs.readdirSync(modsPath);
      for (const modFile of localMods) {
        if (modFile.endsWith('.jar') && !modFilesFromPack.includes(modFile)) {
          console.log(`[Sync] Deleting extra mod: ${modFile}`);
          try {
            fs.unlinkSync(join(modsPath, modFile));
          } catch (e) {
            console.warn(`[Sync] Failed to delete mod ${modFile}: ${e}`);
          }
        }
      }
    }

    // 2. Extract overrides
    console.log("Extracting overrides...")
    const entries = zip.getEntries()
    let entryCount = 0;

    entries.forEach(entry => {
      entryCount++;
      if (entry.entryName.startsWith('overrides/')) {
        const relPath = entry.entryName.replace('overrides/', '')
        if (entry.isDirectory) {
          const dirPath = join(mcPath, relPath)
          if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })
        } else {
          const destPath = join(mcPath, relPath)
          const destDir = join(destPath, '..')
          if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })

          // ✅ Mods = Config and Replace: Always overwrite configs/overrides
          console.log(`[Sync] Applying override: ${relPath}`);
          fs.writeFileSync(destPath, entry.getData())
        }
      }
    })

    // Create a signature file (Anti-theft: Lock to this machine)
    const signaturePath = join(mcPath, '.launcher_sig')
    const machineID = getMachineFingerprint();
    fs.writeFileSync(signaturePath, JSON.stringify({
      launcher: "Frontline Project Launcher",
      version: "2.4.0",
      timestamp: Date.now(),
      machine: machineID,
      key: "FRONTLINE_SECURE_KEY_8899",
      packSource: zipUrl,
      minecraft: minecraftVersion || "1.21.1",
      fabric: fabricVersion || null
    }))

    // 3. Automatically download and install Fabric Profile JSON if needed
    if (minecraftVersion || "1.21.1") {
      const mcVer = minecraftVersion || "1.21.1";

      console.log(`[Sync] Fetching real Fabric loader for MC ${mcVer}...`);
      try {
        const mcPath = join(app.getPath('userData'), 'FrontlineProject', 'game')
        const location: MinecraftLocation = mcPath

        // ✅ ดึง loader version จริงจาก API
        const loaderRes = await axios.get(`https://meta.fabricmc.net/v2/versions/loader/${mcVer}`);
        const data = loaderRes.data;

        if (Array.isArray(data) && data.length > 0) {
          const realLoaderVersion = data[0].loader.version;
          console.log(`[Sync] Found real loader: ${realLoaderVersion}`);

          const fabricId = `fabric-loader-${realLoaderVersion}-${mcVer}`;

          const { getVersionList, install } = require('@xmcl/installer');

          // Step 2: Install Vanilla first (MANDATORY)
          const versionList = await getVersionList();
          const vanilla = versionList.versions.find((v: any) => v.id === mcVer);
          if (vanilla) {
            console.log(`[Sync] Installing Vanilla ${mcVer} for Fabric base...`);
            await install(vanilla, location);
          }

          // Step 3: ดาวน์โหลด Fabric Profile JSON โดยตรง (Bypass getFabricLoaderArtifact)
          console.log(`[Sync] Downloading Fabric Profile for ${fabricId}...`);
          const profileUrl = `https://meta.fabricmc.net/v2/versions/loader/${mcVer}/${realLoaderVersion}/profile/json`;
          const profileRes = await axios.get(profileUrl);
          const profileJson = profileRes.data;

          const versionDir = join(mcPath, 'versions', fabricId);
          if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true });

          const jsonPath = join(versionDir, `${fabricId}.json`);
          fs.writeFileSync(jsonPath, JSON.stringify(profileJson, null, 2));
          console.log(`[Sync] Profile JSON saved ✅`);

          // ✅ Step 3.5: Patch Manifest for MCLC
          const manifestPath = join(mcPath, 'versions', 'version_manifest.json');
          let manifest = { versions: [] as any[] };
          if (fs.existsSync(manifestPath)) {
            try {
              manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            } catch (e) {
              console.error("[Sync] Failed to parse manifest, creating new one.");
            }
          }

          if (!manifest.versions.find((v: any) => v.id === fabricId)) {
            manifest.versions.unshift({
              id: fabricId,
              type: 'release',
              url: '',
              time: new Date().toISOString(),
              releaseTime: new Date().toISOString()
            });
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
            console.log(`[Sync] Manifest Patched: ${fabricId} ✅`);
          }

          // Update signature with the actual version and ID
          const sig = JSON.parse(fs.readFileSync(signaturePath, 'utf8'));
          sig.fabric = realLoaderVersion;
          sig.fabricId = fabricId;
          fs.writeFileSync(signaturePath, JSON.stringify(sig));
          console.log(`[Sync] Signature updated: fabric=${realLoaderVersion}`);
        } else {
          console.error(`[Sync] No Fabric loader found for MC ${mcVer}`);
        }
      } catch (e) {
        console.error("[Sync] Fabric install failed:", e);
      }
    }
  } else {
    // Normal zip extraction
    zip.extractAllTo(mcPath, true)
  }

  if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile)
  return { success: true, path: mcPath }
}

ipcMain.handle('sync-mods', async (_, zipUrl: string) => {
  try {
    return await syncModsInternal(zipUrl)
  } catch (err) {
    console.error("Mod Sync Error:", err)
    return { success: false, error: String(err) }
  }
})

ipcMain.handle('get-installed-mods', async () => {
  try {
    const mcPath = join(app.getPath('userData'), 'FrontlineProject', 'game')
    const modsPath = join(mcPath, 'mods')
    if (!fs.existsSync(modsPath)) return []

    const files = fs.readdirSync(modsPath)
    return files.filter(file => file.endsWith('.jar'))
  } catch (err) {
    console.error("List Mods Error:", err)
    return []
  }
})

ipcMain.handle('install-fabric', async (_, mcVersion: string, fabricVersion?: string) => {
  try {
    const mcPath = join(app.getPath('userData'), 'FrontlineProject', 'game')
    const location: MinecraftLocation = mcPath

    // ✅ Step 1: ดึง loader version จริงจาก API
    console.log(`[Fabric] Fetching loader for MC: ${mcVersion}...`);
    const loaderRes = await axios.get(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`);

    if (!loaderRes.data || loaderRes.data.length === 0) {
      return { success: false, error: `ไม่พบ Fabric สำหรับ Minecraft ${mcVersion}` };
    }

    const latestLoader = loaderRes.data[0].loader.version;
    const fabricId = `fabric-loader-${latestLoader}-${mcVersion}`;
    console.log(`📦 [Fabric] Target ID: ${fabricId}`);

    // ✅ Step 2: ติดตั้ง Vanilla ก่อนเสมอ (MANDATORY)
    const { getVersionList, install, installDependencies } = require('@xmcl/installer');
    console.log('[Fabric] Fetching version manifest...');
    const versionList = await getVersionList();
    const vanillaVersion = versionList.versions.find((v: any) => v.id === mcVersion);

    if (!vanillaVersion) {
      return { success: false, error: `ไม่พบ Minecraft ${mcVersion}` };
    }

    console.log(`[Fabric] Installing Vanilla ${mcVersion}...`);
    await install(vanillaVersion, location);
    console.log('[Fabric] Vanilla installed ✅');

    // ✅ Step 3: ดาวน์โหลด Fabric Profile JSON โดยตรง (Bypass getFabricLoaderArtifact)
    console.log('[Fabric] Downloading Profile JSON...');
    const profileUrl = `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${latestLoader}/profile/json`;
    const profileRes = await axios.get(profileUrl);
    const profileJson = profileRes.data;

    const versionDir = join(mcPath, 'versions', fabricId);
    if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true });

    const jsonPath = join(versionDir, `${fabricId}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(profileJson, null, 2));
    console.log(`[Fabric] Profile JSON saved to: ${jsonPath} ✅`);

    // ✅ Step 4: Inject Fabric เข้าไปใน version_manifest.json
    const manifestPath = join(mcPath, 'versions', 'version_manifest.json');
    const patchManifest = (id: string) => {
      let manifest = { versions: [] as any[] };
      if (fs.existsSync(manifestPath)) {
        try {
          manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        } catch (e) {
          console.error("[Manifest] Failed to parse manifest, creating new one.");
        }
      }

      const exists = manifest.versions.find((v: any) => v.id === id);
      if (!exists) {
        manifest.versions.unshift({
          id: id,
          type: 'release',
          url: '',
          time: new Date().toISOString(),
          releaseTime: new Date().toISOString()
        });
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        console.log(`[Manifest] Patched: ${id} ✅`);
      }
    };
    patchManifest(fabricId);

    // ✅ Step 5: ติดตั้ง dependencies ของ Fabric (libraries)
    const { MinecraftVersion } = require('@xmcl/core');
    const fabricVersionObj = await MinecraftVersion.resolveFromPath(location, fabricId);
    await installDependencies(fabricVersionObj);
    console.log('[Fabric] Dependencies installed ✅');

    return { success: true, fabricId, loaderVersion: latestLoader };
  } catch (e) {
    console.error('[Fabric] Error:', e);
    return { success: false, error: String(e) };
  }
});

ipcMain.handle('get-fabric-versions', async () => {
  try {
    const response = await axios.get('https://meta.fabricmc.net/v2/versions/game');
    return response.data.filter((v: any) => v.stable);
  } catch (e) {
    console.error('[Fabric] Failed to fetch versions:', e);
    return [];
  }
});

// Function to download and extract Java 21 (Runtime) automatically
async function downloadJavaRuntime(): Promise<string | undefined> {
  const platform = process.platform;
  const javaDir = join(app.getPath('userData'), 'FrontlineProject', 'runtime', 'java21');
  const javaExe = platform === 'win32' 
    ? join(javaDir, 'bin', 'java.exe')
    : join(javaDir, 'bin', 'java');

  if (fs.existsSync(javaExe)) return javaExe;

  if (!fs.existsSync(javaDir)) fs.mkdirSync(javaDir, { recursive: true });

  console.log("[Java] Starting automatic Java 21 download for", platform);
  if (win) win.webContents.send('launch-progress', { type: 'java', task: 0, total: 100, message: 'Downloading Java 21 Runtime...' });

  try {
    let javaUrl: string;
    
    if (platform === 'win32') {
      // Windows x64 JRE
      javaUrl = "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%2B13/OpenJDK21U-jre_x64_windows_hotspot_21.0.2_13.zip";
    } else if (platform === 'darwin') {
      // macOS (arm64 and x64 support)
      const arch = process.arch === 'arm64' ? 'aarch64' : 'x64';
      javaUrl = `https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%2B13/OpenJDK21U-jre_${arch}_mac_hotspot_21.0.2_13.tar.gz`;
    } else if (platform === 'linux') {
      // Linux x64 JRE
      const arch = process.arch === 'arm64' ? 'aarch64' : 'x64';
      javaUrl = `https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%2B13/OpenJDK21U-jre_${arch}_linux_hotspot_21.0.2_13.tar.gz`;
    } else {
      console.error("[Java] Unsupported platform:", platform);
      return undefined;
    }

    const response = await axios.get(javaUrl, { 
      responseType: 'arraybuffer',
      onDownloadProgress: (progressEvent: any) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        if (win) win.webContents.send('launch-progress', { 
          type: 'java', 
          task: percentCompleted, 
          total: 100, 
          message: `Downloading Java 21... ${percentCompleted}%` 
        });
      }
    });

    if (win) win.webContents.send('launch-progress', { type: 'java', task: 100, total: 100, message: 'Extracting Java 21...' });
    
    if (platform === 'win32') {
      // Windows: Extract from ZIP
      const zip = new AdmZip(response.data);
      const zipEntries = zip.getEntries();
      
      // The zip usually has a root folder like 'jdk-21.0.2+13-jre'
      const rootFolder = zipEntries[0].entryName.split(/[\\\/]/)[0];
      
      zip.extractAllTo(join(javaDir, '..'), true);
      
      // Rename extracted folder to 'java21' for consistency
      const extractedPath = join(javaDir, '..', rootFolder);
      if (fs.existsSync(extractedPath) && extractedPath !== javaDir) {
        fs.renameSync(extractedPath, javaDir);
      }
    } else {
      // macOS and Linux: Save as tar.gz for manual extraction
      // Note: For production, consider using a proper tar extraction library
      const tarPath = join(javaDir, '..', 'java21.tar.gz');
      fs.writeFileSync(tarPath, response.data);
      console.log("[Java] Java 21 tar.gz saved. Please extract manually or use system package manager.");
      console.log("[Java] For automated extraction, install tar command-line tool.");
      // For now, return undefined to let user install manually
      return undefined;
    }

    if (fs.existsSync(javaExe)) {
      console.log("[Java] Java 21 Runtime installed successfully.");
      return javaExe;
    }
  } catch (e) {
    console.error("[Java] Failed to download Java 21:", e);
  }
  return undefined;
}

// Function to check Java version
async function getJavaVersion(javaPath: string): Promise<number> {
  return new Promise((resolve) => {
    try {
      const { exec } = require('child_process');
      exec(`"${javaPath}" -version`, (error: any, stdout: any, stderr: any) => {
        const output = stderr || stdout;
        const versionMatch = output.match(/(?:version|openjdk version) "(\d+)/);
        if (versionMatch) {
          resolve(parseInt(versionMatch[1]));
        } else {
          resolve(0);
        }
      });
    } catch (e) {
      resolve(0);
    }
  });
}

// Function to find the best available Java (prioritizes 64-bit and Version 21+)
async function findBestJava(): Promise<string | undefined> {
  const commonPaths: string[] = [];
  
  if (process.platform === 'win32') {
    // Windows common paths
    commonPaths.push(
      'C:\\Program Files\\Java',
      'C:\\Program Files (x86)\\Java',
      join(process.env.LOCALAPPDATA || '', 'Programs', 'Adoptium'),
      join(process.env.LOCALAPPDATA || '', 'Programs', 'Eclipse Foundation'),
      join(process.env.APPDATA || '', '.minecraft', 'runtime'),
      join(process.env.LOCALAPPDATA || '', 'Packages', 'Microsoft.4297127D64EC6_8wekyb3d8bbwe', 'LocalCache', 'Local', 'runtime')
    );
  } else if (process.platform === 'darwin') {
    // macOS paths
    commonPaths.push(
      '/Library/Java/JavaVirtualMachines',
      '/usr/libexec/java_home',
      join(process.env.HOME || '', 'Library/Java/JavaVirtualMachines'),
      '/opt/homebrew/opt/openjdk',
      '/usr/local/opt/openjdk'
    );
  } else if (process.platform === 'linux') {
    // Linux paths
    commonPaths.push(
      '/usr/lib/jvm',
      '/usr/java',
      join(process.env.HOME || '', '.java'),
      '/opt/java',
      '/snap/bin'
    );
  }

  const checkJavaExe = (dir: string): string | undefined => {
    const platform = process.platform;
    const javaExe = platform === 'win32' ? join(dir, 'java.exe') : join(dir, 'java');
    if (fs.existsSync(javaExe)) return javaExe;
    
    const binJavaExe = platform === 'win32' ? join(dir, 'bin', 'java.exe') : join(dir, 'bin', 'java');
    if (fs.existsSync(binJavaExe)) return binJavaExe;
    return undefined;
  };

  const foundJavas: string[] = [];

  // 1. Check common base paths
  for (const basePath of commonPaths) {
    if (fs.existsSync(basePath)) {
      const scanDir = (dir: string, depth = 0) => {
        if (depth > 5) return;
        try {
          const files = fs.readdirSync(dir);
          if (files.includes('bin') || (process.platform === 'win32' && files.includes('java.exe')) || (process.platform !== 'win32' && files.includes('java'))) {
            const found = checkJavaExe(dir);
            if (found && !foundJavas.includes(found)) foundJavas.push(found);
          }
          for (const file of files) {
            const fullPath = join(dir, file);
            try {
              if (fs.statSync(fullPath).isDirectory()) scanDir(fullPath, depth + 1);
            } catch (e) { }
          }
        } catch (e) { }
      };
      scanDir(basePath);
    }
  }

  // 2. Check PATH environment variable
  const pathEnv = process.env.PATH || '';
  const pathDirs = pathEnv.split(process.platform === 'win32' ? ';' : ':');
  for (const dir of pathDirs) {
    const javaPath = process.platform === 'win32' ? join(dir, 'java.exe') : join(dir, 'java');
    if (fs.existsSync(javaPath) && !foundJavas.includes(javaPath)) {
      foundJavas.push(javaPath);
    }
  }

  if (foundJavas.length > 0) {
    // Prioritize Version 21+ and 64-bit
    let bestJava: string | undefined = undefined;
    let highestVersion = 0;

    for (const java of foundJavas) {
      const is64 = await isJava64Bit(java);
      const version = await getJavaVersion(java);
      
      if (is64 && version >= 21) {
        return java; // Found perfect match
      }
      
      if (version > highestVersion) {
        highestVersion = version;
        bestJava = java;
      }
    }
    
    // If we have a Java but it's not 21, we'll return undefined to trigger download
    if (highestVersion < 21) return undefined;
    
    return bestJava;
  }

  return undefined;
}

// Function to check if java is 64-bit
async function isJava64Bit(javaPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const { spawn } = require('child_process');
      const java = spawn(javaPath, ['-d64', '-version']);

      java.on('error', () => resolve(false));
      java.on('close', (code: number) => {
        // If -d64 is supported, it's 64-bit. Some JVMs might exit with 0, others with error if not supported.
        // A better way is to check the output of `java -version`
        const { exec } = require('child_process');
        exec(`"${javaPath}" -version`, (error: any, stdout: any, stderr: any) => {
          const output = stderr || stdout;
          if (output.includes('64-Bit') || output.includes('x86_64') || output.includes('amd64')) {
            resolve(true);
          } else {
            resolve(false);
          }
        });
      });
    } catch (e) {
      resolve(false);
    }
  });
}

ipcMain.handle('kill-game', async () => {
  if (gameProcess) {
    try {
      console.log("[Launch] Killing game process...");
      gameProcess.kill();
      gameProcess = null;
      return { success: true };
    } catch (e: any) {
      console.error("[Launch] Failed to kill game:", e);
      return { success: false, error: e.message };
    }
  }
  return { success: false, error: "Game is not running" };
});

ipcMain.handle('cancel-prepare', async () => {
  if (isPreparing) {
    console.log("[Prepare] Cancelling preparation...");
    isPreparing = false;
    return { success: true };
  }
  return { success: false, error: "Not preparing" };
});

ipcMain.handle('prepare-game', async (_, options: any) => {
  const { profile, version, modpackUrl } = options
  const mcPath = join(app.getPath('userData'), 'FrontlineProject', 'game')

  isPreparing = true;

  let javaPath = options.javaPath || await findBestJava();
  
  // If no Java found, download it automatically
  if (!javaPath) {
    console.log("[Prepare] Java not found on system. Starting automatic download...");
    javaPath = await downloadJavaRuntime();
    if (!javaPath) {
      isPreparing = false;
      return { success: false, error: "Java not found and automatic download failed. Please install Java 17+." };
    }
  }

  let maxMem = options.maxMemory || "4G";
  let minMem = options.minMemory || "2G";

  // Default versions
  let mcVersion = version || "1.21.1";
  let fabricVersion = null;

  try {
    // 0. Pre-check modpack for versions
    if (modpackUrl) {
      if (!isPreparing) throw new Error("Cancelled");
      setRPCActivity('Preparing Game', 'Checking Modpack...', profile?.name || 'Player')
      console.log("[Prepare] Fetching modpack index for version detection...");
      const response = await axios.get(modpackUrl, { responseType: 'arraybuffer' })
      const zip = new AdmZip(response.data)
      const indexEntry = zip.getEntry('modrinth.index.json')
      if (indexEntry) {
        const index = JSON.parse(indexEntry.getData().toString('utf8'))
        mcVersion = index.dependencies?.minecraft || mcVersion;
        fabricVersion = index.dependencies?.fabric || index.dependencies?.['fabric-loader'] || "latest";
        console.log(`[Prepare] Detected from Modpack: MC=${mcVersion}, Fabric=${fabricVersion}`);
      }
    }

    // Check signature if no modpack or as fallback
    const signaturePath = join(mcPath, '.launcher_sig');
    if (fs.existsSync(signaturePath) && !modpackUrl) {
      if (!isPreparing) throw new Error("Cancelled");
      try {
        const sig = JSON.parse(fs.readFileSync(signaturePath, 'utf8'));
        if (sig.fabric) fabricVersion = sig.fabric;
        if (sig.minecraft) mcVersion = sig.minecraft;
      } catch (e) { }
    }

    // Java check...
    if (javaPath) {
      if (!isPreparing) throw new Error("Cancelled");
      const is64 = await isJava64Bit(javaPath);
      if (!is64) {
        maxMem = "1G";
        minMem = "512M";
      }
    }

    // 1. STAGE: Minecraft (Base Assets)
    if (!isPreparing) throw new Error("Cancelled");
    setRPCActivity('Preparing Game', 'Downloading Minecraft...', profile?.name || 'Player')
    if (win) win.webContents.send('launch-progress', { type: 'game', task: 0, total: 100 })

    const opts: any = {
      authorization: profile,
      root: mcPath,
      memory: { max: maxMem, min: minMem },
      javaPath: javaPath,
      version: { number: mcVersion, type: "release" }
    }

    preparer.removeAllListeners('progress')
    preparer.on('progress', (e) => {
      if (!isPreparing) return;
      if (win) win.webContents.send('launch-progress', { ...e, type: 'game' })
    })

    console.log(`[Prepare] Stage 1: Minecraft (${mcVersion})`)
    await preparer.prepare(opts as any)
    if (win) win.webContents.send('launch-progress', { type: 'game', task: 100, total: 100 })

    // 2. STAGE: Fabric
    if (win) win.webContents.send('launch-progress', { type: 'fabric', task: 0, total: 100 })
    if (fabricVersion) {
      if (!isPreparing) throw new Error("Cancelled");
      setRPCActivity('Preparing Game', 'Installing Fabric...', profile?.name || 'Player')

      console.log(`[Prepare] Stage 2: Fabric (${fabricVersion})`);
      const loaderRes = await axios.get(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`);
      if (loaderRes.data && loaderRes.data.length > 0) {
        const latestLoader = loaderRes.data[0].loader.version;
        const fabricId = `fabric-loader-${latestLoader}-${mcVersion}`;

        if (!isPreparing) throw new Error("Cancelled");
        if (win) win.webContents.send('launch-progress', { type: 'fabric', task: 50, total: 100 });

        const profileUrl = `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${latestLoader}/profile/json`;
        const profileRes = await axios.get(profileUrl);
        const versionDir = join(mcPath, 'versions', fabricId);
        if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true });
        fs.writeFileSync(join(versionDir, `${fabricId}.json`), JSON.stringify(profileRes.data, null, 2));
      }
    }
    if (win) win.webContents.send('launch-progress', { type: 'fabric', task: 100, total: 100 })

    // 3. STAGE: Mods (Sync + Config/Replace)
    if (win) win.webContents.send('launch-progress', { type: 'mod', task: 0, total: 100 })
    if (modpackUrl) {
      if (!isPreparing) throw new Error("Cancelled");
      setRPCActivity('Preparing Game', 'Syncing Mods & Configs...', profile?.name || 'Player')
      console.log("[Prepare] Stage 3: Mods (Config & Replace)")
      await syncModsInternal(modpackUrl, (current, total) => {
        if (!isPreparing) return;
        if (win) win.webContents.send('launch-progress', { type: 'mod', task: current, total: total })
      })
    }
    if (win) win.webContents.send('launch-progress', { type: 'mod', task: 100, total: 100 })

    isPreparing = false;
    return { success: true }
  } catch (err: any) {
    console.error("Prepare Error:", err)
    isPreparing = false;
    if (err.message === "Cancelled") return { success: false, error: "Cancelled" };
    return { success: false, error: String(err) }
  }
})

ipcMain.handle('launch-game', async (_, options: any) => {
  const { profile, version } = options
  const mcPath = join(app.getPath('userData'), 'FrontlineProject', 'game')

  // 2. Anti-Theft Verification (Machine ID)
  const authSigPath = join(mcPath, '.launcher_sig')
  if (fs.existsSync(authSigPath)) {
    try {
      const sig = JSON.parse(fs.readFileSync(authSigPath, 'utf8'));
      if (sig.machine && sig.machine !== getMachineFingerprint()) {
        return { success: false, error: "ตรวจพบการใช้งานข้ามเครื่อง (Machine ID Mismatch) กรุณาใช้ Launcher เครื่องเดิมที่ดาวน์โหลดมอด" };
      }
    } catch (e) {
      console.error("Signature read error:", e);
    }
  }

  // Auto-detect Java if not provided
  let javaPath = options.javaPath || await findBestJava();
  let maxMem = options.maxMemory || "4G";
  let minMem = options.minMemory || "2G";

  // Check signature for Fabric/Minecraft version
  let fabricVersion = null;
  let mcVersion = version || "1.21.1";
  const launchSigPath = join(mcPath, '.launcher_sig')
  if (fs.existsSync(launchSigPath)) {
    try {
      const sig = JSON.parse(fs.readFileSync(launchSigPath, 'utf8'));
      if (sig.fabric) fabricVersion = sig.fabric;
      if (sig.minecraft) mcVersion = sig.minecraft;
      console.log(`[Launch] Signature detected: MC=${mcVersion}, Fabric=${fabricVersion || 'None'}`);
    } catch (e) { }
  }

  // Auto-detect Fabric from versions folder if not in signature
  if (!fabricVersion) {
    const versionsDir = join(mcPath, 'versions');
    if (fs.existsSync(versionsDir)) {
      const dirs = fs.readdirSync(versionsDir);
      const fabricDir = dirs.find(d => d.startsWith('fabric-loader-'));
      if (fabricDir) {
        console.log(`[Launch] Auto-detected Fabric in versions: ${fabricDir}`);
        fabricVersion = fabricDir;
      }
    }
  }

  // Check Java bitness if we found a path
  if (javaPath) {
    const is64 = await isJava64Bit(javaPath);
    if (!is64) {
      console.warn("[Java] 32-bit Java detected! Capping memory to 1G.");
      maxMem = "1G";
      minMem = "512M";
    }
  }

  console.log("Using Java Path:", javaPath || "Default (PATH)");
  console.log(`Memory Settings: Max=${maxMem}, Min=${minMem}`);

  const fabricId = fabricVersion?.startsWith('fabric-loader')
    ? fabricVersion
    : (fabricVersion ? `fabric-loader-${fabricVersion}-${mcVersion}` : null);

  const opts: any = {
    authorization: {
      access_token: profile.access_token,
      client_token: profile.client_token,
      uuid: profile.uuid,
      name: profile.name,
      user_properties: profile.user_properties || "{}"
    },
    root: mcPath,
    memory: {
      max: maxMem,
      min: minMem
    },
    javaPath: javaPath,
    customArgs: [
      "-Dfrontline.launcher=true",
      "-Dfrontline.key=FRONTLINE_SECURE_KEY_8899"
    ],
    // ✅ บังคับให้ใช้ Manifest ในเครื่องเท่านั้นเพื่อความเร็วและลด Error
    versionCustom: join(mcPath, 'versions', 'version_manifest.json')
  }

  // Load full version JSON for custom versions to skip manifest lookup
  if (fabricId) {
    const jsonPath = join(mcPath, 'versions', fabricId, `${fabricId}.json`);
    if (fs.existsSync(jsonPath)) {
      opts.version = {
        number: mcVersion,
        type: "release",
        custom: fabricId
      };
      console.log(`[Launch] Using custom version for ${fabricId}`);
    } else {
      console.error(`[Launch] Fabric JSON not found at: ${jsonPath}`);
      return { success: false, error: "ไม่พบไฟล์ตั้งค่า Fabric กรุณากด Sync มอดใหม่อีกครั้ง" };
    }
  } else {
    opts.version = { number: mcVersion, type: "release" };
  }

  console.log(`[Launch] Version ID: ${opts.version.id || opts.version.number} (${opts.version.type || 'custom-obj'})`);

  try {
    // Clear old progress handlers to avoid duplication
    launcher.removeAllListeners('progress');
    launcher.on('progress', (e) => {
      if (win) win.webContents.send('launch-progress', { ...e, type: 'game' });
    });

    const launchResult = launcher.launch(opts as any);

    // Check if launch() returned a promise (MCLC v3+ behavior)
    if (launchResult instanceof Promise) {
      gameProcess = await launchResult;
    } else {
      gameProcess = launchResult;
    }

    // Default values if remote config not available
    let rpcDetails = "Playing Minecraft";
    let rpcState = `Server: Frontline Project`;

    // Try to fetch remote config for RPC
    try {
      const axios = require('axios');
      const response = await axios.get("https://raw.githubusercontent.com/phumitchreal/Frontline-Project/main/launcher_config.json");
      if (response.data && response.data.RPC) {
        rpcDetails = response.data.RPC.DETAILS || rpcDetails;
        rpcState = response.data.RPC.STATE || rpcState;
      }
    } catch (e) {
      console.warn("[RPC] Could not fetch remote config for RPC, using defaults");
    }

    setRPCActivity(rpcDetails, rpcState, profile.name)

    // Hide launcher when game starts (if configured or by default)
    if (win && !isDev) {
      console.log("[Launch] Hiding launcher window...");
      win.hide();
    }

    gameProcess.on('debug', (e: any) => console.log(`[MC DEBUG] ${e}`))
    gameProcess.on('data', (e: any) => console.log(`[MC DATA] ${e}`))

    gameProcess.on('close', (code: number) => {
      console.log(`Game closed with code ${code}`)
      gameProcess = null;
      setRPCActivity('Home Page', 'Logged in', profile.name)

      // Show launcher back when game closes
      if (win) {
        console.log("[Launch] Showing launcher window back...");
        win.show();
        win.webContents.send('game-closed', code)
      }
    })

    return { success: true }
  } catch (err) {
    console.error("Launch Error:", err)
    return { success: false, error: String(err) }
  }
})
