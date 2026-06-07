import { contextBridge, ipcRenderer } from 'electron'

// Expõe APIs seguras para a janela do Next.js
contextBridge.exposeInMainWorld('electronAPI', {
  getVersion:         ()          => ipcRenderer.invoke('app-version'),
  openExternal:       (url: string) => ipcRenderer.invoke('open-external', url),
  checkForUpdates:    ()          => ipcRenderer.invoke('check-for-updates'),

  // Escuta eventos do main process
  onUpdateAvailable:  (cb: (version: string) => void) =>
    ipcRenderer.on('update-available', (_, v) => cb(v)),
  onUpdateProgress:   (cb: (percent: number) => void) =>
    ipcRenderer.on('update-progress', (_, p) => cb(p)),
  onTriggerUpdateCheck: (cb: () => void) =>
    ipcRenderer.on('trigger-update-check', () => cb()),
})
