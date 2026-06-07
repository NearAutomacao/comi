declare global {
  interface Window {
    electronAPI?: {
      getVersion: () => Promise<string>
      openExternal: (url: string) => Promise<void>
      checkForUpdates: () => Promise<void>
      setRestaurantConfig: (payload: {
        restaurantId: string
        printerConfig?: { kitchenHost: string; kitchenPort: number; barHost: string; barPort: number }
      }) => Promise<{ ok: boolean }>
      onUpdateAvailable: (cb: (version: string) => void) => void
      onUpdateProgress: (cb: (percent: number) => void) => void
      onTriggerUpdateCheck: (cb: () => void) => void
    }
  }
}

export const isElectron = (): boolean =>
  typeof window !== 'undefined' && !!window.electronAPI

export const electronAPI = () => window.electronAPI
