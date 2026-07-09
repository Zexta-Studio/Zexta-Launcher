import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { CONFIG } from './config';

type Tab = 'Account' | 'Minecraft' | 'Appearance' | 'About' | 'Reset';
type NavItem = 'launch' | 'settings' | 'changelog';

interface Toast { message: string; type: 'info' | 'error' | 'success'; }
interface ConfirmState { show: boolean; title?: string; message: string; confirmLabel?: string; variant?: 'danger' | 'warning' | 'default'; onConfirm: () => void; }
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
  const [confirmModal, setConfirmModal] = useState<ConfirmState>({ show: false, message: '', onConfirm: () => {} });
  const [remoteConfig, setRemoteConfig] = useState<any>(CONFIG);
  const [announcements] = useState<string[]>(CONFIG.ANNOUNCEMENTS || []);
  const initialVersion = useRef<string | null>(null);
  const [maxMemory, setMaxMemory] = useState(localStorage.getItem('maxMemory') || CONFIG.DEFAULT_MAX_RAM);
  const [showIp, setShowIp] = useState(false);
  const [showKillConfirm, setShowKillConfirm] = useState(false);
  const [gameLog, setGameLog] = useState<string>('');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || '');

  const showToast = (message: string, type: Toast['type'] = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const showConfirm = (message: string, onConfirm: () => void, opts?: { title?: string; confirmLabel?: string; variant?: 'danger' | 'warning' | 'default' }) => {
    setConfirmModal({ show: true, message, onConfirm, ...opts });
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
      appearance: 'Appearance',
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
      dashboard: 'Dashboard',
      changelog: 'Changelog',
      sign_in_desc: 'Sign in with your Microsoft account to authenticate and download your profile.',
      game_config: 'Game Configuration',
      game_config_desc: 'Customize local Minecraft runtime settings.',
      appearance_desc: 'Customize the launcher theme and accent color.',
      accent_color: 'Accent Color',
      preview: 'Preview',
      danger_zone: 'Danger Zone',
      danger_zone_desc: 'Executing a hard reset will permanently delete all local game settings, cached files, authenticated profiles, and client configurations.',
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
      appearance: 'ลักษณะ',
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
      dashboard: 'หน้าหลัก',
      changelog: 'ข่าวสาร',
      sign_in_desc: 'ลงชื่อเข้าใช้ด้วยบัญชี Microsoft เพื่อยืนยันตัวตนและดาวน์โหลดโปรไฟล์',
      game_config: 'ตั้งค่าเกม',
      game_config_desc: 'ปรับแต่งการตั้งค่า Minecraft ในเครื่อง',
      appearance_desc: 'ปรับแต่งธีมและสีของ Launcher',
      accent_color: 'สีหลัก',
      preview: 'ตัวอย่าง',
      danger_zone: 'โซนอันตราย',
      danger_zone_desc: 'การรีเซ็ตจะลบข้อมูลทั้งหมดของ Launcher อย่างถาวร รวมถึงการตั้งค่า ไฟล์แคช และโปรไฟล์',
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

  useEffect(() => {
    if (theme) { document.documentElement.className = `theme-${theme}`; }
    else { document.documentElement.className = ''; }
  }, [theme]);

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
        className="group relative w-[12px] h-[12px] rounded-full bg-[#ff5f56] flex items-center justify-center cursor-pointer transition-all duration-150 active:scale-[0.85] hover:ring-1 hover:ring-red-400/30">
        <span className="hidden group-hover:block text-[8px] text-[#4c0002] font-bold select-none absolute">×</span>
      </div>
      <div onClick={() => invoke('window_action', { action: 'minimize' })}
        className="group relative w-[12px] h-[12px] rounded-full bg-[#ffbd2e] flex items-center justify-center cursor-pointer transition-all duration-150 active:scale-[0.85] hover:ring-1 hover:ring-yellow-400/30">
        <span className="hidden group-hover:block text-[8px] text-[#5c3e00] font-bold select-none absolute">−</span>
      </div>
      <div className="w-[12px] h-[12px] rounded-full bg-[#27c93f] opacity-40 cursor-default hover:opacity-60 transition-opacity duration-150" />
    </div>
  );

  const ToastBadge = () => {
    if (!toast) return null;
    const icons: Record<string, React.ReactNode> = {
      success: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
      error: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
      info: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
    };
    const colors: Record<string, string> = {
      error: 'text-red-400 border-red-500/20 bg-red-950/20',
      success: 'text-green-400 border-green-500/20 bg-green-950/20',
      info: 'text-white/80 border-white/10 bg-black/40',
    };
    const progressColors: Record<string, string> = {
      error: 'bg-red-500/30',
      success: 'bg-green-500/30',
      info: 'bg-white/20',
    };
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] animate-slide-up pointer-events-none">
        <div className={`glass flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-xs font-medium tracking-wide shadow-2xl overflow-hidden relative ${colors[toast.type]}`}>
          <div className={`absolute bottom-0 left-0 h-[2px] rounded-full ${progressColors[toast.type]} animate-toast-progress`} />
          {icons[toast.type]}
          {toast.message}
        </div>
      </div>
    );
  };

  const ConfirmModal = () => {
    if (!confirmModal.show) return null;
    const isDanger = confirmModal.variant === 'danger';
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[4px] animate-fade-in no-drag">
        <div className="w-[360px] p-6 rounded-2xl border border-white/[0.08] bg-[#0c0c0e]/95 shadow-2xl space-y-5 animate-scale-in text-center">
          <div className={`w-12 h-12 rounded-full ${isDanger ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'} border flex items-center justify-center mx-auto`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div className="space-y-1.5">
            <h3 className="text-white font-bold text-sm">{confirmModal.title || 'Confirm'}</h3>
            <p className="text-white/40 text-xs leading-relaxed">{confirmModal.message}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setConfirmModal(s => ({ ...s, show: false }))}
              className="flex-1 py-2 rounded-lg border border-white/[0.08] hover:bg-white/5 text-white/70 hover:text-white text-xs font-medium transition-all cursor-pointer">
              {t.cancel}
            </button>
            <button onClick={() => { confirmModal.onConfirm(); setConfirmModal(s => ({ ...s, show: false })); }}
              className={`flex-1 py-2 rounded-lg ${isDanger ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-white hover:bg-neutral-200 text-black'} text-xs font-semibold transition-all shadow-md cursor-pointer`}>
              {confirmModal.confirmLabel || t.confirm}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (view === 'loading') {
    return (
      <div data-tauri-drag-region className="drag-region bg-radial-dark flex items-center justify-center min-h-screen antialiased select-none overflow-hidden">
        <div className="flex flex-col items-center gap-6 animate-scale-in-bounce">
          <div className="w-14 h-14 opacity-80 animate-logo-pulse">
            <img src="/zexta-logo.png" className="w-full h-full object-contain" alt="" />
          </div>
          <div className="w-32 h-[3px] bg-white/5 rounded-full overflow-hidden">
            <div className="h-full w-1/3 bg-white/40 rounded-full animate-loading" />
          </div>
        </div>
      </div>
    );
  }

  if (view === 'login') {
    return (
      <div className="bg-radial-dark flex items-center justify-center min-h-screen antialiased select-none overflow-hidden">
        <div className="relative w-[1100px] h-[650px] overflow-hidden glass-panel rounded-2xl flex flex-col animate-scale-in-bounce">
          <div className="absolute inset-0 opacity-[0.03]">
            <img src={remoteConfig.BG_IMAGE_URL} className="w-full h-full object-cover" alt="" />
          </div>
          <div data-tauri-drag-region className="drag-region relative z-10 px-6 py-4 flex items-center justify-between border-b border-white/[0.04]" style={{ background: 'linear-gradient(180deg, rgba(12,12,14,0.95) 0%, rgba(8,8,10,0.8) 100%)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/8 to-transparent" />
            <WindowControls />
            <span className="text-[10px] text-white/20 font-medium tracking-wide">Authentication</span>
            <div className="w-12" />
          </div>
          <div className="flex-1 relative z-10 flex items-center justify-center">
            <div className="flex flex-col items-center gap-6 max-w-sm w-full p-8 rounded-[16px] glass animate-scale-in-bounce">
              <div className="w-14 h-14 flex items-center justify-center">
                <img src="/zexta-logo.png" className="w-full h-full object-contain opacity-85" alt="" />
              </div>
              <div className="text-center space-y-2">
                <h1 className="text-white text-xl font-bold tracking-tight">Zexta Launcher</h1>
                <p className="text-white/35 text-xs leading-relaxed max-w-[260px] mx-auto">{t.sign_in_desc}</p>
              </div>
              <button onClick={handleLogin} disabled={loading}
                className="btn-accent w-full text-[13px]">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-[1.5px] border-white/30 border-t-white rounded-full animate-spin" />
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
    <div className="bg-radial-dark flex items-center justify-center min-h-screen antialiased select-none overflow-hidden">
      {/* Ambient Vision Pro gradient orbs */}
      <div className="ambient-orb w-[300px] h-[300px] -top-20 -left-20" style={{ background: 'var(--accent)', animationDelay: '0s' }} />
      <div className="ambient-orb w-[250px] h-[250px] -bottom-20 -right-20" style={{ background: 'var(--accent)', animationDelay: '-7s', opacity: '0.04' }} />
      <div className="ambient-orb w-[200px] h-[200px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ background: 'var(--accent)', animationDelay: '-14s', opacity: '0.03' }} />
      <ToastBadge />
      <ConfirmModal />

      <div className="relative w-[1100px] h-[650px] overflow-hidden glass-panel rounded-2xl animate-scale-in-bounce flex flex-col">
        {/* Subtle background texture */}
        <div className="absolute inset-0 opacity-[0.025] pointer-events-none">
          <img src={remoteConfig.BG_IMAGE_URL} className="w-full h-full object-cover filter blur-[1px]" alt="" />
        </div>

        {/* ─── Vision Pro Header ─── */}
        <div data-tauri-drag-region className="drag-region w-full h-[52px] px-5 flex items-center justify-between relative z-20" style={{ background: 'rgba(6,6,10,0.85)', backdropFilter: 'blur(40px) saturate(1.4)', WebkitBackdropFilter: 'blur(40px) saturate(1.4)' }}>
          
          <div className="flex items-center">
            {/* macOS Window Controls */}
            <WindowControls />

            {/* Logo */}
            <div className="flex items-center gap-2 ml-4 no-drag">
              <div className="w-[18px] h-[18px] flex items-center justify-center">
                <img src="/zexta-logo.png" className="w-full h-full object-contain" alt="" />
              </div>
            </div>

            {/* Nav Tabs */}
            <nav className="flex items-center ml-8 no-drag">
              {(['launch', 'settings', 'changelog'] as NavItem[]).map(item => (
                <button key={item} onClick={() => setCurrentNav(item)}
                  className={`relative px-3 py-1.5 text-[11px] font-medium transition-colors duration-200 cursor-pointer ${
                    currentNav === item ? 'text-white/90' : 'text-white/25 hover:text-white/50'
                  }`}>
                  {item === 'launch' ? t.dashboard : item === 'settings' ? t.settings : t.changelog}
                  {currentNav === item && (
                    <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full" style={{ background: 'var(--accent)' }} />
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* User Profile */}
          {user && (
            <div className="flex items-center no-drag">
              <div className="flex items-center gap-2 px-2 py-0.5 rounded-full bg-white/[0.02]">
                <div className="w-[14px] h-[14px] rounded-full overflow-hidden shrink-0">
                  <img src={`https://mc-heads.net/avatar/${user.id}/24`} className="w-full h-full object-cover" alt="" />
                </div>
                <span className="text-white/50 text-[10px] truncate max-w-[60px]">{user.name}</span>
                <button onClick={() => showConfirm(t.confirm_logout, () => { setUser(null); setMcToken(null); localStorage.removeItem('savedProfile'); setView('login'); }, { title: t.logout, variant: 'danger' })}
                  className="p-0.5 rounded text-white/15 hover:text-red-400 transition-colors duration-200 cursor-pointer" title={t.logout}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ─── Main Content Area ─── */}
        <div className="flex-1 overflow-y-auto p-5 relative z-10" style={{ background: 'rgba(4, 4, 6, 0.4)' }}>
          
          {/* ─── Dashboard ─── */}
          {currentNav === 'launch' && (
            <div className="h-full grid grid-cols-12 gap-4 animate-scale-in">
              
              {/* ─── Left Panel ─── */}
              <div className="col-span-8 glass-card rounded-[12px] p-0 animate-slide-up overflow-hidden relative group" style={{ animationDelay: '0.05s' }}>
                {/* Banner background */}
                {remoteConfig.BG_IMAGE_URL && (
                  <div className="absolute inset-0 opacity-[0.035] pointer-events-none">
                    <img src={remoteConfig.BG_IMAGE_URL} className="w-full h-full object-cover" alt="" />
                  </div>
                )}
                {/* Bottom glass reflection */}
                <div className="absolute bottom-0 left-0 right-0 h-1/3 pointer-events-none" style={{ background: 'linear-gradient(0deg, rgba(255,255,255,0.02) 0%, transparent 100%)' }} />
                
                <div className="relative h-full flex flex-col p-7">
                  
                  {/* Top */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-white/25 text-[10px] font-medium">{remoteConfig.PROJECT_NAME}</span>
                        <span className="px-2 py-[2px] rounded text-[7px] font-medium" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--accent)' }}>v{remoteConfig.VERSION}</span>
                      </div>
                      <p className="text-white/25 text-[11px]">Minecraft {remoteConfig.MC_VERSION} &middot; Fabric</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white/15 text-[8px]">{t.season}</p>
                      <p className="text-white/70 text-xs font-medium">{remoteConfig.SEASON_NAME}</p>
                    </div>
                  </div>

                  {/* Center */}
                  <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    {launchProgress ? (
                      <div className="w-full max-w-[200px] space-y-2">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-white/35 truncate max-w-[70%]">{launchProgress.message || stage || 'Downloading\u2026'}</span>
                          <span className="text-white/50 font-mono">{launchProgress.pct !== undefined ? launchProgress.pct : (launchProgress.total > 0 ? Math.round((launchProgress.task / launchProgress.total) * 100) : 0)}%</span>
                        </div>
                        <div className="w-full h-[2px] bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${launchProgress.pct !== undefined ? launchProgress.pct : (launchProgress.total > 0 ? Math.round((launchProgress.task / launchProgress.total) * 100) : 0)}%`, background: 'var(--accent)' }} />
                        </div>
                      </div>
                    ) : isGameRunning ? (
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        <span className="text-white/60 text-xs">{t.playing}</span>
                      </div>
                    ) : (
                      <p className="text-white/20 text-[11px]">{t.ready}</p>
                    )}

                    {/* Button */}
                    <div className="w-full max-w-[200px]">
                      {launchProgress ? null : isGameRunning ? (
                        <button onClick={handleLaunch} className="btn-kill">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>{t.kill}
                        </button>
                      ) : (
                        <button onClick={handleLaunch} disabled={launching} className="btn-accent w-full text-xs py-3.5">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                          {t.launch}
                        </button>
                      )}
                    </div>

                    {/* Game Log */}
                    {isGameRunning && gameLog && (
                      <div className="w-full max-w-[260px] p-2.5 rounded-[8px] border border-white/[0.03] text-[8px] text-white/25 leading-relaxed truncate font-mono" style={{ background: 'rgba(0,0,0,0.3)' }}>
                        <span className="text-emerald-500/50 mr-1.5">[Game]</span>
                        {gameLog}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ─── Right ─── */}
              <div className="col-span-4 flex flex-col gap-3 relative">
                {remoteConfig.BG_IMAGE_URL && (
                  <div className="absolute inset-0 opacity-[0.025] pointer-events-none rounded-[10px] overflow-hidden">
                    <img src={remoteConfig.BG_IMAGE_URL} className="w-full h-full object-cover" alt="" />
                  </div>
                )}
                
                {/* Server */}
                <div className="glass-card p-4 animate-slide-up relative" style={{ animationDelay: '0.1s' }}>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-white/15 text-[8px] uppercase tracking-[0.1em]">Server</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1 h-1 rounded-full ${serverStatus?.online ? 'bg-green-400' : 'bg-red-500/60'}`} />
                      <span className={`text-[7px] ${serverStatus?.online ? 'text-green-400/50' : 'text-red-400/50'}`}>{serverStatus?.online ? t.online : t.offline}</span>
                    </div>
                  </div>
                  <div className="flex items-end gap-1.5 mb-2">
                    <span className="text-white text-lg font-semibold">{serverStatus?.players?.online ?? '0'}</span>
                    <span className="text-white/15 text-[10px] mb-[2px]">/ {serverStatus?.players?.max ?? '?'}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.02]">
                    <span className="text-white/12 text-[8px]">24ms</span>
                    <button onClick={() => setShowIp(!showIp)} className="text-white/12 hover:text-white/40 transition-colors text-[8px] cursor-pointer font-mono">
                      {showIp ? remoteConfig.SERVER_IP : '••••••••••••••••'}
                    </button>
                  </div>
                </div>

                {/* RAM */}
                <div className="glass-card p-4 animate-slide-up" style={{ animationDelay: '0.15s' }}>
                  <span className="text-white/15 text-[8px] uppercase tracking-[0.1em] block mb-2.5">{t.ram}</span>
                  <div className="flex gap-1 mac-segment-track">
                    {['2G', '4G', '6G', '8G'].map(s => (
                      <button key={s} onClick={() => handleSaveSettings('maxMemory', s)}
                        className={`btn-segment ${maxMemory === s ? 'active' : ''}`}>{s}</button>
                    ))}
                  </div>
                </div>

                {/* Broadcast */}
                <div className="flex-1 glass-card p-4 animate-slide-up overflow-hidden" style={{ animationDelay: '0.2s' }}>
                  <span className="text-white/15 text-[8px] uppercase tracking-[0.1em] block mb-2.5">Broadcast</span>
                  <div className="space-y-2.5 max-h-[110px] overflow-y-auto">
                    {announcements.length === 0 ? (
                      <p className="text-white/12 text-[10px]">No announcements</p>
                    ) : (
                      announcements.map((msg, i) => (
                        <div key={i} className="flex items-start gap-2 text-[10px] leading-relaxed text-white/30">
                          <span className="w-[3px] h-[3px] rounded-full mt-[4px] shrink-0" style={{ background: 'var(--accent)' }} />
                          <p>{msg}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ─── macOS Settings ─── */}
          {currentNav === 'settings' && (
            <div className="h-full flex gap-5 animate-scale-in">
              {/* macOS System Preferences-style Sidebar */}
              <div className="w-[190px] shrink-0 space-y-0.5">
                {(['Account', 'Minecraft', 'Appearance', 'About', 'Reset'] as Tab[]).map(tab => {
                  const icons: Record<string, string> = {
                    Account: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
                    Minecraft: 'M20 12H4m16-6H4m16 12H4',
                    Appearance: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
                    About: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
                    Reset: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
                  };
                  return (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`btn-sidebar-tab ${activeTab === tab ? 'active' : ''}`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <path d={icons[tab]} />
                      </svg>
                      {t[tab.toLowerCase()]}
                    </button>
                  );
                })}
              </div>

              {/* macOS Preference Pane */}
              <div className="flex-1 glass-card p-7 overflow-y-auto max-h-[460px]">
                {activeTab === 'Account' && user && (
                  <div className="space-y-6 animate-slide-right">
                    <div>
                      <h3 className="text-white font-semibold text-sm">Account details</h3>
                      <p className="text-white/35 text-xs mt-1">Manage launcher credentials and session profiles.</p>
                    </div>
                    
                    <div className="flex items-center gap-5 p-4 rounded-[10px] border border-white/[0.05] bg-[rgba(0,0,0,0.2)]">
                      <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 ring-1 ring-white/10">
                        <img src={`https://mc-heads.net/avatar/${user.id}/80`} className="w-full h-full object-cover" alt="" />
                      </div>
                      <div className="space-y-2 flex-1 min-w-0">
                        <div>
                          <span className="text-white/20 text-[9px] font-medium tracking-wider uppercase block">{t.player}</span>
                          <span className="text-white text-base font-semibold mt-0.5 block truncate">{user.name}</span>
                        </div>
                        <div>
                          <span className="text-white/20 text-[9px] font-medium tracking-wider uppercase block">{t.uuid}</span>
                          <span className="text-white/35 text-[10px] font-mono mt-0.5 block truncate select-all">{user.id}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                      <span className="text-white/35 text-xs">{t.ms_auth}</span>
                      <button onClick={() => showConfirm(t.confirm_logout, () => { setUser(null); setMcToken(null); localStorage.removeItem('savedProfile'); setView('login'); }, { title: t.logout, variant: 'danger' })}
                        className="px-4 py-2 rounded-[8px] text-red-400 bg-red-500/10 hover:bg-red-500/15 text-xs transition-colors cursor-pointer font-medium">
                        {t.logout}
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'Minecraft' && (
                  <div className="space-y-6 animate-slide-right">
                    <div>
                      <h3 className="text-white font-medium text-sm">{t.game_config}</h3>
                      <p className="text-white/40 text-xs mt-1">{t.game_config_desc}</p>
                    </div>

                    {/* Memory Allocator */}
                    <div className="space-y-3">
                      <span className="text-white/45 text-xs block font-medium">{t.ram}</span>
                      <div className="flex gap-1 max-w-sm mac-segment-track">
                    {['2G', '4G', '6G', '8G'].map(s => (
                      <button key={s} onClick={() => handleSaveSettings('maxMemory', s)}
                        className={`btn-segment ${maxMemory === s ? 'active' : ''}`}>{s}</button>
                    ))}
                  </div>
                </div>

                {/* Language */}
                <div className="space-y-3">
                  <span className="text-white/45 text-xs block font-medium">{t.lang_label}</span>
                  <div className="flex gap-1 max-w-[120px] mac-segment-track">
                    {['EN', 'TH'].map(l => (
                      <button key={l} onClick={() => { setLang(l); localStorage.setItem('lang', l); }}
                        className={`btn-segment ${lang === l ? 'active' : ''}`}>{l}</button>
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

                {activeTab === 'Appearance' && (
                  <div className="space-y-6 animate-slide-right max-w-md">
                    <div>
                      <h3 className="text-white font-semibold text-sm">{t.appearance}</h3>
                      <p className="text-white/35 text-xs mt-1">{t.appearance_desc}</p>
                    </div>
                    <div className="space-y-3">
                      <span className="text-white/45 text-xs font-medium">{t.accent_color}</span>
                      <div className="flex gap-2.5 flex-wrap">
                        {[
                          { id: '', label: 'Blue', class: 'bg-[#007AFF]' },
                          { id: 'purple', label: 'Purple', class: 'bg-[#5856D6]' },
                          { id: 'green', label: 'Green', class: 'bg-[#34C759]' },
                          { id: 'orange', label: 'Orange', class: 'bg-[#FF9500]' },
                          { id: 'red', label: 'Red', class: 'bg-[#FF3B30]' },
                          { id: 'mono', label: 'Mono', class: 'bg-[#8E8E93]' },
                        ].map(c => (
                          <button key={c.id} onClick={() => { setTheme(c.id); localStorage.setItem('theme', c.id); }}
                            className={`btn-swatch ${c.class} ${theme === c.id ? 'active' : ''}`}>
                            {theme === c.id && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <span className="text-white/45 text-xs font-medium">{t.preview}</span>
                      <div className="p-4 rounded-[10px] border border-white/[0.06] flex items-center gap-3" style={{ background: 'var(--card-bg)' }}>
                        <div className="w-3 h-3 rounded-full" style={{ background: 'var(--accent)' }} />
                        <span className="text-white/60 text-xs">Accent color preview</span>
                        <div className="px-3 py-1 rounded-md text-white text-[10px] font-medium" style={{ background: 'var(--accent)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)' }}>Button</div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'About' && (
                  <div className="flex flex-col items-center justify-center py-8 text-center space-y-5 animate-scale-in-bounce">
                    <div className="w-16 h-16 flex items-center justify-center">
                      <img src="/zexta-logo.png" className="w-full h-full object-contain opacity-80" alt="" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-white text-lg font-bold tracking-tight">Zexta Launcher</h3>
                      <p className="text-white/25 text-[10px] tracking-wider">{t.build}: <span className="text-white/45">{remoteConfig.VERSION}</span></p>
                    </div>
                    <div className="w-8 h-[1px] bg-white/[0.05]" />
                    <p className="text-white/45 text-xs max-w-[280px] leading-relaxed">A high-performance Minecraft client manager built on top of Rust/Tauri client-server engine.</p>
                    
                    <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-left w-full max-w-[280px] pt-4 border-t border-white/[0.05]">
                      <div className="space-y-0.5">
                        <span className="text-white/15 text-[9px] font-medium tracking-wider uppercase block">{t.developer}</span>
                        <span className="text-white/55 text-xs block">Zexta Project</span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-white/15 text-[9px] font-medium tracking-wider uppercase block">{t.runtime}</span>
                        <span className="text-white/55 text-xs block">Tauri v2</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'Reset' && (
                  <div className="space-y-5 animate-slide-right max-w-md">
                    <div>
                      <h3 className="text-red-400 font-semibold text-sm">System Recovery</h3>
                      <p className="text-white/35 text-xs mt-1">Reset client local store states and clean directories.</p>
                    </div>
                    
                    <div className="p-5 rounded-[10px] border border-red-500/12 bg-red-500/[0.03] space-y-3">
                      <div className="flex items-center gap-2.5 text-red-400 text-xs font-semibold">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        {t.danger_zone}
                      </div>
                      <p className="text-white/35 text-[11px] leading-relaxed">{t.danger_zone_desc}</p>
                      
                      <button onClick={() => showConfirm(t.confirm_reset, async () => {
                        try { showToast('Resetting database\u2026', 'info'); await invoke('reset_launcher_data'); localStorage.clear(); window.location.reload(); }
                        catch { showToast('Failed to reset', 'error'); }
                      }, { title: t.reset_confirm, confirmLabel: t.reset_confirm, variant: 'danger' })} className="btn-danger-action">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        {t.reset_confirm}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── Changelog ─── */}
          {currentNav === 'changelog' && (
            <div className="h-full space-y-4 max-h-[460px] overflow-y-auto pr-2 animate-slide-up">
              {remoteConfig.CHANGELOG?.map((patch: any, i: number) => (
                <div key={i} className="rounded-[10px] p-5 bg-[rgba(7,7,9,0.6)] border border-white/[0.05] space-y-3 animate-slide-up-bounce transition-all duration-200" style={{ animationDelay: `${i * 0.08}s` }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-2.5">
                      <h3 className="text-white font-semibold text-sm">{patch.title}</h3>
                      <span className="text-white/25 text-[10px] px-1.5 py-0.5 rounded bg-white/[0.03] font-mono">v{patch.version}</span>
                    </div>
                    <span className="text-white/20 text-[9px] font-mono">{patch.date}</span>
                  </div>
                  {patch.changes && patch.changes.length > 0 && (
                    <ul className="space-y-1.5 pt-2 border-t border-white/[0.04]">
                      {patch.changes?.map((c: string, j: number) => (
                        <li key={j} className="flex items-start gap-2.5 text-white/40 text-[11px] leading-relaxed">
                          <span className="w-1 h-1 rounded-full bg-white/20 mt-1.5 shrink-0" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Connected Ticker at Bottom (Unified layout footer bar) */}
        {announcements.length > 0 && currentNav === 'launch' && (
          <div className="h-[28px] border-t border-white/[0.05] bg-[#070708] flex items-center overflow-hidden relative">
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#070708] to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#070708] to-transparent z-10 pointer-events-none" />
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

