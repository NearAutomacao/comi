import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion:       ()             => ipcRenderer.invoke('app-version'),
  openExternal:     (url: string)  => ipcRenderer.invoke('open-external', url),
  checkForUpdates:  ()             => ipcRenderer.invoke('check-for-updates'),

  setRestaurantConfig: (payload: {
    restaurantId: string
    printerConfig?: { kitchenHost: string; kitchenPort: number; barHost: string; barPort: number }
  }) => ipcRenderer.invoke('set-restaurant-config', payload),

  onUpdateAvailable:    (cb: (version: string) => void) =>
    ipcRenderer.on('update-available',    (_, v) => cb(v)),
  onUpdateProgress:     (cb: (percent: number) => void) =>
    ipcRenderer.on('update-progress',     (_, p) => cb(p)),
  onTriggerUpdateCheck: (cb: () => void) =>
    ipcRenderer.on('trigger-update-check', () => cb()),
})
