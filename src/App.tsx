import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { CONFIG } from './config';

type Tab = 'Account' | 'Minecraft' | 'About' | 'Reset';
type NavItem = 'launch' | 'settings' | 'changelog';

interface Toast { message: string; type: 'info' | 'error' | 'success'; }
interface ServerData { online: boolean; players?: { online: number; max: number }; motd?: string; }

const App = () => {
  const [view, setView] = useState<'loading' | 'login' | 'main'>('loading');
  const [currentNav, setCurrentNav] = useState<NavItem>('launch');
  const [activeTab, setActiveTab] = useState<Tab>('Account');
  const [user, setUser] = useState<any>(null);
  const [mcToken, setMcToken] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [launchProgress, setLaunchProgress] = useState<any>(null);
  const [serverStatus, setServerStatus] = useState<ServerData | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [lang, setLang] = useState(localStorage.getItem('lang') || 'EN');
  const [toast, setToast] = useState<Toast | null>(null);
  const [remoteConfig, setRemoteConfig] = useState<any>(CONFIG);
  const [announcements] = useState<string[]>(CONFIG.ANNOUNCEMENTS || []);
  const initialVersion = useRef<string | null>(null);
  const [maxMemory, setMaxMemory] = useState(localStorage.getItem('maxMemory') || CONFIG.DEFAULT_MAX_RAM);
  const [showIp, setShowIp] = useState(false);
  const [showKillConfirm, setShowKillConfirm] = useState(false);
  const [gameLog, setGameLog] = useState<string>('');

  const showToast = (message: string, type: Toast['type'] = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Dual-language translation mapping
  const translations: Record<string, Record<string, string>> = {
    EN: {
      login_sub: 'Sign in with Microsoft',
      login_loading: 'Signing in\u2026',
      cancel: 'Cancel',
      confirm: 'Confirm',
      launch: 'Launch Game',
      running: 'Running',
      kill: 'Kill Game',
      ready: 'Ready to Play',
      playing: 'Playing Minecraft',
      server: 'Server Status',
      online: 'Online',
      offline: 'Offline',
      settings: 'Settings',
      account: 'Account',
      minecraft: 'Game Preferences',
      about: 'About Client',
      reset: 'Reset Client',
      player: 'Player Name',
      uuid: 'Player UUID',
      ms_auth: 'Microsoft Account',
      logout: 'Sign Out',
      confirm_logout: 'Are you sure you want to sign out?',
      confirm_kill: 'Are you sure you want to force close the game?',
      ram: 'Allocated Memory (RAM)',
      lang_label: 'Interface Language',
      version: 'Minecraft Version',
      build: 'Build Signature',
      developer: 'Developer Team',
      runtime: 'Runtime Platform',
      confirm_reset: 'This will reset all launcher data. Continue?',
      reset_confirm: 'Confirm Hard Reset',
      season: 'Active Season',
      patch_btn: 'Update Changelog',
    },
    TH: {
      login_sub: 'ลงชื่อเข้าใช้ด้วย Microsoft',
      login_loading: 'กำลังลงชื่อเข้าใช้\u2026',
      cancel: 'ยกเลิก',
      confirm: 'ยืนยัน',
      launch: 'เริ่มเกม',
      running: 'กำลังทำงาน',
      kill: 'ปิดเกม',
      ready: 'พร้อมเล่น',
      playing: 'กำลังเล่น Minecraft',
      server: 'สถานะเซิร์ฟเวอร์',
      online: 'ออนไลน์',
      offline: 'ออฟไลน์',
      settings: 'ตั้งค่า',
      account: 'บัญชี',
      minecraft: 'ตั้งค่าเกม',
      about: 'เกี่ยวกับระบบ',
      reset: 'รีเซ็ตไคลเอนต์',
      player: 'ชื่อผู้เล่น',
      uuid: 'UUID ผู้เล่น',
      ms_auth: 'บัญชี Microsoft',
      logout: 'ออกจากระบบ',
      confirm_logout: 'คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?',
      confirm_kill: 'คุณแน่ใจหรือไม่ว่าต้องการบังคับปิดเกม?',
      ram: 'หน่วยความจำที่จัดสรร (RAM)',
      lang_label: 'ภาษาของระบบ',
      version: 'เวอร์ชัน Minecraft',
      build: 'ลายเซ็นระบบ',
      developer: 'ทีมผู้พัฒนา',
      runtime: 'แพลตฟอร์มรันไทม์',
      confirm_reset: 'ต้องการรีเซ็ตข้อมูลทั้งหมดของ Launcher ใช่หรือไม่?',
      reset_confirm: 'ยืนยันการล้างข้อมูล',
      season: 'ซีซันปัจจุบัน',
      patch_btn: 'บันทึกการอัปเดต',
    }
  };

  const t = translations[lang] || translations.EN;

  useEffect(() => {
    (async () => {
      try {
        const config = await invoke<any>('get_remote_config');
        setRemoteConfig({ ...CONFIG, ...config });
        if (!initialVersion.current && config.VERSION) initialVersion.current = config.VERSION;
      } catch {}
      const saved = localStorage.getItem('savedProfile');
      if (saved) {
        try {
          const p = JSON.parse(saved);
          if (p?.id && p?.name) {
            setUser(p);
            const a = localStorage.getItem('savedAuth');
            setMcToken(a ? JSON.parse(a)?.token || '' : '');
            setView('main');
            fetchServerStatus();
            return;
          }
        } catch {}
        localStorage.removeItem('savedProfile');
      }
      setTimeout(() => setView('login'), 800);
    })();
  }, []);

  useEffect(() => {
    const ul: (() => void)[] = [];
    listen<any>('launch-progress', (e: any) => {
      const p = e.payload;
      setLaunchProgress(p);
      const pct = Math.round((p.task / p.total) * 100);
      if (p.type === 'game') setStage(`Downloading (${pct}%)`);
      else if (p.type === 'fabric') setStage(`Installing Fabric (${pct}%)`);
      else if (p.type === 'mod') setStage(`Syncing Mods (${pct}%)`);
    }).then((f: any) => ul.push(f));
    listen<number>('game-closed', () => { setLaunching(false); setIsGameRunning(false); setLaunchProgress(null); setStage(null); setGameLog(''); }).then((f: any) => ul.push(f));
    listen<string>('game-log', (e: any) => { setGameLog(e.payload); }).then((f: any) => ul.push(f));
    return () => ul.forEach((f: any) => f());
  }, []);

  const fetchServerStatus = async () => {
    try { setServerStatus(await invoke<ServerData>('get_server_status', { ip: remoteConfig.MASTER_SERVER })); } catch {}
  };
  useEffect(() => { if (view === 'main' && mcToken) fetchServerStatus(); }, [view, mcToken]);

  const handleLaunch = async () => {
    if (!mcToken) {
      showToast('Authentication token is missing. Please log in again.', 'error');
      return;
    }
    if (isGameRunning) { 
      setShowKillConfirm(true);
      return; 
    }
    setLaunching(true); setStage('Preparing assets\u2026');
    try {
      const prepared = await invoke<any>('prepare_game', { options: { profile: mcToken, version: "1.21.1", maxMemory, minMemory: "2G", modpackUrl: remoteConfig.MODPACK_URL } });
      if (!prepared) {
        showToast('Preparation failed. Please check modpack URL.', 'error'); 
        setLaunching(false); 
        setStage(null); 
        return;
      }
      setStage('Launching client\u2026');
      const launched = await invoke<any>('launch_game', { options: { profile: mcToken, version: "1.21.1", maxMemory, minMemory: "2G" } });
      if (!launched) {
        showToast('Launch command failed to start client.', 'error');
        setLaunching(false); 
        setStage(null);
        setLaunchProgress(null);
      } else { 
        setIsGameRunning(true); 
        setLaunching(false); 
        setStage(null); 
        setLaunchProgress(null);
      }
    } catch (e) { 
      showToast('Launch exception: ' + String(e), 'error');
      setLaunching(false); 
      setStage(null); 
      setLaunchProgress(null);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const r = await invoke<any>('login_microsoft');
      if (r?.success && r?.profile) {
        setUser(r.profile); setMcToken(r.token);
        localStorage.setItem('savedProfile', JSON.stringify(r.profile));
        localStorage.setItem('savedAuth', JSON.stringify({ token: r.token, save_data: r.save_data }));
        setView('main');
      } else showToast(r?.error || 'Login failed', 'error');
    } catch (e) { showToast(String(e), 'error'); }
    finally { setLoading(false); }
  };

  const handleSaveSettings = (k: string, v: string) => {
    localStorage.setItem(k, v);
    if (k === 'maxMemory') setMaxMemory(v);
  };

  const WindowControls = () => (
    <div className="no-drag flex items-center gap-[8px]">
      <div onClick={() => invoke('window_action', { action: 'close' })}
        className="group relative w-[12px] h-[12px] rounded-full bg-[#ff5f56] flex items-center justify-center cursor-pointer transition-all duration-150 active:scale-90">
        <span className="hidden group-hover:block text-[8px] text-[#4c0002] font-bold select-none absolute">×</span>
      </div>
      <div onClick={() => invoke('window_action', { action: 'minimize' })}
        className="group relative w-[12px] h-[12px] rounded-full bg-[#ffbd2e] flex items-center justify-center cursor-pointer transition-all duration-150 active:scale-90">
        <span className="hidden group-hover:block text-[8px] text-[#5c3e00] font-bold select-none absolute">−</span>
      </div>
      <div className="w-[12px] h-[12px] rounded-full bg-[#27c93f] opacity-40 cursor-default" />
    </div>
  );

  const ToastBadge = () => {
    if (!toast) return null;
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] animate-slide-up">
        <div className={`glass px-4 py-2 rounded-lg text-xs font-medium tracking-wide shadow-2xl ${
          toast.type === 'error' ? 'text-red-400 border-red-500/20 bg-red-950/20' :
          toast.type === 'success' ? 'text-green-400 border-green-500/20 bg-green-950/20' :
          'text-white/80 border-white/10 bg-black/40'
        }`}>{toast.message}</div>
      </div>
    );
  };

  if (view === 'loading') {
    return (
      <div data-tauri-drag-region className="drag-region bg-radial-dark flex items-center justify-center min-h-screen font-sans antialiased select-none overflow-hidden">
        <div className="flex flex-col items-center gap-6 animate-scale-in">
          <div className="w-12 h-12 opacity-80 animate-logo-pulse">
            <img src="/zexta-logo.png" className="w-full h-full object-contain" alt="" />
          </div>
          <div className="w-24 h-[2px] bg-white/5 rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-white/30 rounded-full animate-loading" />
          </div>
        </div>
      </div>
    );
  }

  if (view === 'login') {
    return (
      <div className="bg-radial-dark flex items-center justify-center min-h-screen font-sans antialiased select-none overflow-hidden">
        <div className="relative w-[1100px] h-[650px] overflow-hidden glass-panel rounded-2xl flex flex-col">
          <div className="absolute inset-0 opacity-[0.03]">
            <img src={remoteConfig.BG_IMAGE_URL} className="w-full h-full object-cover" alt="" />
          </div>
          <div data-tauri-drag-region className="drag-region relative z-10 px-6 py-4 flex items-center justify-between border-b border-white/[0.04] bg-black/20">
            <WindowControls />
            <span className="text-[10px] font-mono tracking-widest text-white/30 uppercase">Secure Client Authentication</span>
            <div className="w-12" /> {/* spacer */}
          </div>
          <div className="flex-1 relative z-10 flex items-center justify-center">
            <div className="flex flex-col items-center gap-7 max-w-sm w-full p-8 rounded-2xl glass bg-black/10 border-white/[0.06] animate-scale-in">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white/[0.02] border border-white/10 p-2.5">
                <img src="/zexta-logo.png" className="w-full h-full object-contain opacity-80" alt="" />
              </div>
              <div className="text-center space-y-1.5">
                <h1 className="text-white text-xl font-medium tracking-tight">Zexta Launcher</h1>
                <p className="text-white/40 text-xs font-normal leading-relaxed">Sign in with your Microsoft account to authenticate and download your profile.</p>
              </div>
              <button onClick={handleLogin} disabled={loading}
                className="w-full relative flex items-center justify-center gap-3 px-5 py-3 rounded-xl btn-primary-glow font-medium text-sm transition-all duration-200 disabled:opacity-40 focus-ring cursor-pointer">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-[1.5px] border-black/30 border-t-black rounded-full animate-spin" />
                    {t.login_loading}
                  </span>
                ) : (
                  <>
                    <svg viewBox="0 0 21 21" className="w-[16px] h-[16px] shrink-0">
                      <rect x="1" y="1" width="9" height="9" rx="1" fill="#f25022" />
                      <rect x="11" y="1" width="9" height="9" rx="1" fill="#7fbb00" />
                      <rect x="1" y="11" width="9" height="9" rx="1" fill="#00a1f1" />
                      <rect x="11" y="11" width="9" height="9" rx="1" fill="#ffbb00" />
                    </svg>
                    {t.login_sub}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-radial-dark flex items-center justify-center min-h-screen font-sans antialiased select-none overflow-hidden">
      <ToastBadge />

      <div className="relative w-[1100px] h-[650px] overflow-hidden glass-panel rounded-2xl animate-scale-in flex flex-col bg-black">
        {/* Subtle background texture */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
          <img src={remoteConfig.BG_IMAGE_URL} className="w-full h-full object-cover filter blur-[2px]" alt="" />
        </div>

        {/* ─── Top Header (macOS titlebar + Next.js Nav hybrid) ─── */}
        <div data-tauri-drag-region className="drag-region w-full h-[64px] px-6 flex items-center justify-between border-b border-white/[0.08] bg-[#070708] relative z-20">
          <div className="flex items-center gap-6">
            {/* macOS Window Controls */}
            <WindowControls />
            
            {/* Divider */}
            <div className="w-[1px] h-4 bg-white/10" />

            {/* Logo + Title */}
            <div className="flex items-center gap-2.5 no-drag">
              <div className="w-6 h-6 rounded-md bg-white/[0.03] border border-white/10 flex items-center justify-center p-1 shadow-sm">
                <img src="/zexta-logo.png" className="w-full h-full object-contain opacity-90" alt="" />
              </div>
              <span className="text-white font-semibold tracking-tight text-xs">Zexta Launcher</span>
            </div>

            {/* Next.js Header Navigation Tabs */}
            <nav className="flex items-center gap-1.5 ml-4 no-drag">
              <button onClick={() => setCurrentNav('launch')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  currentNav === 'launch' ? 'bg-white/5 text-white shadow-sm border border-white/[0.08]' : 'text-white/40 hover:text-white/80'
                }`}>
                Dashboard
              </button>
              <button onClick={() => setCurrentNav('settings')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  currentNav === 'settings' ? 'bg-white/5 text-white shadow-sm border border-white/[0.08]' : 'text-white/40 hover:text-white/80'
                }`}>
                Settings
              </button>
              <button onClick={() => setCurrentNav('changelog')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  currentNav === 'changelog' ? 'bg-white/5 text-white shadow-sm border border-white/[0.08]' : 'text-white/40 hover:text-white/80'
                }`}>
                Changelog
              </button>
            </nav>
          </div>

          {/* User Profile Area */}
          {user && (
            <div className="flex items-center gap-3 no-drag">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-[#0c0c0e]">
                <div className="w-5 h-5 rounded-md overflow-hidden border border-white/10 shrink-0">
                  <img src={`https://mc-heads.net/avatar/${user.id}/32`} className="w-full h-full object-cover" alt="" />
                </div>
                <span className="text-white/80 text-[10px] font-mono tracking-wide truncate max-w-[80px]">{user.name}</span>
                <button onClick={() => { if (confirm(t.confirm_logout)) { setUser(null); setMcToken(null); localStorage.removeItem('savedProfile'); setView('login'); } }}
                  className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer" title={t.logout}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ─── Main Content Area (Unified Grid System) ─── */}
        <div className="flex-1 overflow-y-auto p-6 relative z-10 bg-[#040405]">
          
          {/* ─── Play Dashboard Route ─── */}
          {currentNav === 'launch' && (
            <div className="h-full grid grid-cols-12 gap-6 animate-scale-in">
              
              {/* Left Column: Big Banner console (7 cols) */}
              <div className="col-span-8 flex flex-col justify-between rounded-2xl bg-[#070709] relative overflow-hidden group p-7 premium-card">
                {/* Banner background art with gradient occlusion */}
                <div className="absolute inset-0 opacity-[0.06] group-hover:opacity-[0.09] transition-opacity duration-500 pointer-events-none">
                  <img src={remoteConfig.BG_IMAGE_URL} className="w-full h-full object-cover" alt="" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#070709] via-[#070709]/50 to-transparent pointer-events-none" />

                {/* Top Info */}
                <div className="relative z-10 flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/50 font-mono text-[8px] tracking-wider uppercase">Active Modpack</span>
                    <h2 className="text-white text-lg font-bold tracking-tight mt-1">{remoteConfig.PROJECT_NAME}</h2>
                    <p className="text-white/40 text-xs">Minecraft {remoteConfig.MC_VERSION} &middot; Fabric Launcher</p>
                  </div>
                  <div className="text-right">
                    <span className="text-white/30 text-[9px] font-mono uppercase tracking-widest">{t.season}</span>
                    <span className="text-white/80 font-bold block text-sm tracking-tight">{remoteConfig.SEASON_NAME}</span>
                  </div>
                </div>

                {/* Bottom Console: Launch game & download states */}
                <div className="relative z-10 space-y-5 pt-12">
                  {launchProgress ? (
                    <div className="space-y-2.5 animate-slide-up bg-[#0c0c0e] border border-white/[0.08] p-4 rounded-xl shadow-inner">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="flex items-center gap-2 text-white/60 truncate max-w-[80%]">
                          <div className="w-3 h-3 border-[1.5px] border-white/20 border-t-white/80 rounded-full animate-spin shrink-0" />
                          {launchProgress.message || stage || 'Downloading updates\u2026'}
                        </span>
                        <span className="text-white/80">{launchProgress.pct !== undefined ? launchProgress.pct : (launchProgress.total > 0 ? Math.round((launchProgress.task / launchProgress.total) * 100) : 0)}%</span>
                      </div>
                      <div className="w-full h-[4px] bg-black rounded-full overflow-hidden">
                        <div className="h-full bg-white/50 rounded-full transition-all duration-300 ease-out" style={{ width: `${launchProgress.pct !== undefined ? launchProgress.pct : (launchProgress.total > 0 ? Math.round((launchProgress.task / launchProgress.total) * 100) : 0)}%` }} />
                      </div>
                    </div>
                  ) : (
                    <button onClick={handleLaunch} disabled={launching}
                      className={`w-full py-4 rounded-xl text-xs font-semibold tracking-widest uppercase transition-all duration-200 cursor-pointer focus-ring flex items-center justify-center gap-2.5 ${
                        isGameRunning 
                          ? 'bg-red-500/10 text-red-400 border border-red-500/25 hover:bg-red-500/20 shadow-md' 
                          : 'bg-white text-black hover:bg-neutral-200 shadow-md font-bold'
                      }`}>
                      {isGameRunning ? (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
                          {t.kill}
                        </>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                          {t.launch}
                        </>
                      )}
                    </button>
                  )}

                  {isGameRunning && gameLog && (
                    <div className="p-3.5 rounded-xl border border-white/[0.06] bg-[#09090b]/80 font-mono text-[9px] text-white/40 leading-relaxed truncate shadow-inner animate-slide-up">
                      <span className="text-emerald-500/70 select-none mr-2 font-bold">[Game]</span>
                      {gameLog}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Information & Fast Config (4 cols) */}
              <div className="col-span-4 flex flex-col gap-5">
                
                {/* Connection Status Card */}
                <div className="rounded-2xl p-5 bg-[#070709] premium-card flex flex-col justify-between h-[120px]">
                  <div className="flex items-center justify-between">
                    <span className="text-white/30 text-[9px] font-mono tracking-widest uppercase">Connection Status</span>
                    <div className={`w-2 h-2 rounded-full ${serverStatus?.online ? 'bg-green-400/80 animate-pulse' : 'bg-red-500/60'}`} />
                  </div>
                  <div className="flex items-baseline gap-1 mt-1.5">
                    <span className="text-white text-2xl font-bold tracking-tight">{serverStatus?.players?.online ?? '0'}</span>
                    <span className="text-white/40 text-xs">/ {serverStatus?.players?.max ?? '?'} active</span>
                  </div>
                  <div className="border-t border-white/[0.04] pt-2 flex items-center justify-between text-[10px] text-white/40">
                    <span>Latency: 24ms (Optimal)</span>
                    <button onClick={() => setShowIp(!showIp)} className="font-mono text-white/50 hover:text-white/90 transition-colors flex items-center gap-1 cursor-pointer">
                      {showIp ? remoteConfig.SERVER_IP : '••••••••••••••••'}
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {showIp ? (
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"/>
                        ) : (
                          <>
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </>
                        )}
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Quick Preferences Panel */}
                <div className="rounded-2xl p-5 bg-[#070709] premium-card flex flex-col justify-between h-[150px]">
                  <div>
                    <span className="text-white/30 text-[9px] font-mono tracking-widest uppercase">Quick RAM allocation</span>
                    <p className="text-white/40 text-[10px] mt-1 leading-normal">Allocated execution memory</p>
                  </div>
                  <div className="flex gap-1.5 rounded-xl p-1 mt-4 mac-segment-track">
                    {['2G', '4G', '6G', '8G'].map(s => (
                      <button key={s} onClick={() => handleSaveSettings('maxMemory', s)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-mono transition-all duration-150 cursor-pointer ${
                          maxMemory === s ? 'mac-segment-pill-active text-white' : 'text-white/30 hover:text-white/60 hover:bg-white/[0.01]'
                        }`}>{s}</button>
                    ))}
                  </div>
                </div>

                {/* Announcements ticker console */}
                <div className="flex-1 rounded-2xl p-5 bg-[#070709] premium-card overflow-hidden relative flex flex-col justify-between">
                  <span className="text-white/30 text-[9px] font-mono tracking-widest uppercase block mb-3">Broadcast log</span>
                  <div className="space-y-3.5 max-h-[140px] overflow-y-auto pr-1 flex-1">
                    {announcements.map((msg, i) => (
                      <div key={i} className="flex gap-2.5 text-[11px] leading-relaxed text-white/60 p-2 rounded-lg bg-[#000]/30 border border-white/[0.02]">
                        <span className="w-1.5 h-1.5 rounded-full bg-white/20 mt-1.5 shrink-0" />
                        <p>{msg}</p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ─── Settings Preferences Route ─── */}
          {currentNav === 'settings' && (
            <div className="h-full flex gap-6 animate-scale-in">
              {/* Secondary Navigation */}
              <div className="w-[180px] shrink-0 space-y-1">
                {(['Account', 'Minecraft', 'About', 'Reset'] as Tab[]).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      activeTab === tab ? 'bg-white/5 text-white border border-white/[0.08] shadow-sm' : 'text-white/30 hover:text-white/60 hover:bg-white/[0.01]'
                    }`}>{t[tab.toLowerCase()]}</button>
                ))}
              </div>

              {/* Preferences Editor container */}
              <div className="flex-1 rounded-2xl p-7 bg-[#070709] premium-card overflow-y-auto max-h-[460px]">
                {activeTab === 'Account' && user && (
                  <div className="space-y-6 animate-slide-right">
                    <div>
                      <h3 className="text-white font-medium text-sm">Account details</h3>
                      <p className="text-white/40 text-xs mt-1">Manage launcher credentials and session profiles.</p>
                    </div>
                    
                    <div className="flex items-center gap-5 p-4 rounded-xl border border-white/[0.06] bg-[#000]/30">
                      <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 shrink-0">
                        <img src={`https://mc-heads.net/avatar/${user.id}/80`} className="w-full h-full object-cover" alt="" />
                      </div>
                      <div className="space-y-2 flex-1">
                        <div>
                          <span className="text-white/20 text-[9px] font-mono tracking-widest uppercase block">{t.player}</span>
                          <span className="text-white text-base font-semibold mt-0.5 block">{user.name}</span>
                        </div>
                        <div>
                          <span className="text-white/20 text-[9px] font-mono tracking-widest uppercase block">{t.uuid}</span>
                          <span className="text-white/40 text-[10px] font-mono mt-0.5 block break-all select-all">{user.id}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-white/[0.08]">
                      <span className="text-white/40 text-xs">{t.ms_auth}</span>
                      <button onClick={() => { if (confirm(t.confirm_logout)) { setUser(null); setMcToken(null); localStorage.removeItem('savedProfile'); setView('login'); } }}
                        className="px-4 py-2 rounded-lg text-red-400 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-xs transition-colors cursor-pointer font-medium">
                        {t.logout}
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'Minecraft' && (
                  <div className="space-y-6 animate-slide-right">
                    <div>
                      <h3 className="text-white font-medium text-sm">Game Configuration</h3>
                      <p className="text-white/40 text-xs mt-1">Customize local Minecraft runtime settings.</p>
                    </div>

                    {/* Memory Allocator */}
                    <div className="space-y-3">
                      <span className="text-white/45 text-xs block font-medium">{t.ram}</span>
                      <div className="flex gap-1.5 max-w-sm rounded-xl p-1 mac-segment-track">
                        {['2G', '4G', '6G', '8G'].map(s => (
                          <button key={s} onClick={() => handleSaveSettings('maxMemory', s)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-mono transition-all duration-150 cursor-pointer ${
                              maxMemory === s ? 'mac-segment-pill-active text-white' : 'text-white/30 hover:text-white/60 hover:bg-white/[0.01]'
                            }`}>{s}</button>
                          ))}
                      </div>
                    </div>

                    {/* Language */}
                    <div className="space-y-3">
                      <span className="text-white/45 text-xs block font-medium">{t.lang_label}</span>
                      <div className="flex gap-1.5 max-w-xs rounded-xl p-1 mac-segment-track">
                        {['EN', 'TH'].map(l => (
                          <button key={l} onClick={() => { setLang(l); localStorage.setItem('lang', l); }}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-mono transition-all duration-150 cursor-pointer ${
                              lang === l ? 'mac-segment-pill-active text-white' : 'text-white/30 hover:text-white/60 hover:bg-white/[0.01]'
                            }`}>{l}</button>
                        ))}
                      </div>
                    </div>

                    {/* Version Spec */}
                    <div className="p-4 rounded-xl border border-white/[0.06] bg-[#000]/30 flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-white/40 text-[10px] font-mono tracking-widest uppercase block">{t.version}</span>
                        <span className="text-white/80 text-sm font-semibold block">Minecraft 1.21.1</span>
                      </div>
                      <span className="px-2.5 py-1 rounded bg-[#111] border border-white/[0.08] text-white/50 text-[10px] font-mono">Fabric Core</span>
                    </div>
                  </div>
                )}

                {activeTab === 'About' && (
                  <div className="flex flex-col items-center justify-center py-6 text-center space-y-5 animate-scale-in">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-black/40 border border-white/[0.08] p-2.5 animate-logo-pulse">
                      <img src="/zexta-logo.png" className="w-full h-full object-contain opacity-80" alt="" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-white text-base font-semibold tracking-tight">Zexta Launcher</h3>
                      <p className="text-white/30 text-[9px] font-mono">{t.build}: {remoteConfig.VERSION}</p>
                    </div>
                    <div className="w-8 h-[1px] bg-white/[0.08]" />
                    <p className="text-white/50 text-xs max-w-[280px] leading-relaxed">A high-performance Minecraft client manager built on top of Rust/Tauri client-server engine.</p>
                    
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3 pt-2 text-left w-full max-w-[280px] border-t border-white/[0.06] pt-4">
                      <div>
                        <span className="text-white/20 text-[8px] font-mono uppercase tracking-wider block">{t.developer}</span>
                        <span className="text-white/60 text-xs mt-0.5 block">Zexta Project</span>
                      </div>
                      <div>
                        <span className="text-white/20 text-[8px] font-mono uppercase tracking-wider block">{t.runtime}</span>
                        <span className="text-white/60 text-xs mt-0.5 block">Tauri v2</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'Reset' && (
                  <div className="space-y-5 animate-slide-right max-w-md">
                    <div>
                      <h3 className="text-red-400 font-medium text-sm">System Recovery</h3>
                      <p className="text-white/40 text-xs mt-1">Reset client local store states and clean directories.</p>
                    </div>
                    
                    <div className="p-4 rounded-xl border border-red-500/15 bg-red-500/5 space-y-3 shadow-md">
                      <div className="flex items-center gap-2.5 text-red-400 text-xs font-semibold">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        Danger Zone Action Required
                      </div>
                      <p className="text-white/40 text-[11px] leading-relaxed">Executing a hard reset will permanently delete all local game settings, cached files, authenticated profiles, and client configurations.</p>
                      
                      <button onClick={async () => {
                        if (confirm(t.confirm_reset)) {
                          try { showToast('Resetting database\u2026', 'info'); await invoke('reset_launcher_data'); localStorage.clear(); window.location.reload(); }
                          catch { showToast('Failed to reset', 'error'); }
                        }
                      }} className="px-4 py-2 rounded-lg text-red-400 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-xs transition-colors cursor-pointer font-medium shadow-sm">
                        {t.reset_confirm}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── Changelog Timeline Route ─── */}
          {currentNav === 'changelog' && (
            <div className="h-full space-y-5 max-h-[460px] overflow-y-auto pr-2 animate-scale-in">
              {remoteConfig.CHANGELOG?.map((patch: any, i: number) => (
                <div key={i} className="rounded-2xl p-6 bg-[#070709] border border-white/[0.08] shadow-md space-y-4 animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-2.5">
                      <h3 className="text-white font-semibold text-sm">{patch.title}</h3>
                      <span className="text-white/35 font-mono text-[10px]">v{patch.version}</span>
                    </div>
                    <span className="text-white/30 font-mono text-[9px]">{patch.date}</span>
                  </div>
                  <ul className="space-y-2 border-t border-white/[0.06] pt-3">
                    {patch.changes?.map((c: string, j: number) => (
                      <li key={j} className="flex items-start gap-3 text-white/50 text-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-white/20 mt-1.5 shrink-0" />
                        <span className="leading-relaxed">{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Connected Ticker at Bottom (Unified layout footer bar) */}
        {announcements.length > 0 && currentNav === 'launch' && (
          <div className="h-[28px] border-t border-white/[0.08] bg-[#070708] flex items-center overflow-hidden">
            <div className="flex gap-12 animate-ticker" style={{ width: 'max-content' }}>
              {[...announcements, ...announcements].map((msg, i) => (
                <span key={i} className="text-white/20 text-[9px] font-mono tracking-wider whitespace-nowrap">{msg}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Beautiful Glassmorphic MacOS-style Kill Confirmation Modal */}
      {showKillConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[4px] animate-fade-in no-drag">
          <div className="w-[360px] p-6 rounded-2xl border border-white/[0.08] bg-[#0c0c0e]/95 shadow-2xl space-y-5 animate-scale-in text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-500">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-white font-bold text-sm">Force Close Game</h3>
              <p className="text-white/40 text-xs leading-relaxed">{t.confirm_kill}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowKillConfirm(false)}
                className="flex-1 py-2 rounded-lg border border-white/[0.08] hover:bg-white/5 text-white/70 hover:text-white text-xs font-medium transition-all cursor-pointer">
                {t.cancel}
              </button>
              <button onClick={async () => {
                setShowKillConfirm(false);
                try {
                  await invoke('kill_game');
                  showToast('Game process terminated successfully', 'success');
                } catch (e) {
                  showToast('Failed to kill game: ' + String(e), 'error');
                }
              }} className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-all shadow-md cursor-pointer">
                {t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

