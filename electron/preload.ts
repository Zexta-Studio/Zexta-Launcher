import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  sendWindowAction: (action: 'minimize' | 'close') => ipcRenderer.send('window-controls', action),
  loginMicrosoft: () => ipcRenderer.invoke('login-microsoft'),
  refreshLogin: (token: any) => ipcRenderer.invoke('refresh-login', token),
  prepareGame: (options: any) => ipcRenderer.invoke('prepare-game', options),
  cancelPrepare: () => ipcRenderer.invoke('cancel-prepare'),
  launchGame: (options: any) => ipcRenderer.invoke('launch-game', options),
  killGame: () => ipcRenderer.invoke('kill-game'),
  syncMods: (zipUrl: string) => ipcRenderer.invoke('sync-mods', zipUrl),
  getInstalledMods: () => ipcRenderer.invoke('get-installed-mods'),
  openFileSelector: () => ipcRenderer.invoke('open-file-selector'),
  updateSkin: (token: string, skinPath: string) => ipcRenderer.invoke('update-skin', token, skinPath),
  resetLauncherData: () => ipcRenderer.invoke('reset-launcher-data'),
  getMojangProfile: (token: string) => ipcRenderer.invoke('get-mojang-profile', token),
  installFabric: (mcVersion: string, fabricVersion?: string) => ipcRenderer.invoke('install-fabric', mcVersion, fabricVersion),
  getFabricVersions: () => ipcRenderer.invoke('get-fabric-versions'),
  openExternal: (url: string) => ipcRenderer.send('open-external', url),
  getServerStatus: (ip: string) => ipcRenderer.invoke('get-server-status', ip),
  getRemoteConfig: () => ipcRenderer.invoke('get-remote-config'),
  getInstallerLanguage: () => ipcRenderer.invoke('get-installer-language'),
  
  // Progress listeners
  onLaunchProgress: (callback: (progress: any) => void) => {
    const subscription = (_event: any, progress: any) => callback(progress)
    ipcRenderer.on('launch-progress', subscription)
    return () => ipcRenderer.removeListener('launch-progress', subscription)
  },
  onFabricProgress: (callback: (progress: any) => void) => {
    const subscription = (_event: any, progress: any) => callback(progress)
    ipcRenderer.on('fabric-progress', subscription)
    return () => ipcRenderer.removeListener('fabric-progress', subscription)
  },
  onGameClosed: (callback: (code: number) => void) => {
    const subscription = (_event: any, code: number) => callback(code)
    ipcRenderer.on('game-closed', subscription)
    return () => ipcRenderer.removeListener('game-closed', subscription)
  }
})
