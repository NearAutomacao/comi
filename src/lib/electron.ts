// Utilitários para comunicação com o Electron (só ativo quando rodando no desktop)

declare global {
  interface Window {
    electronAPI?: {
      getVersion: () => Promise<string>
      openExternal: (url: string) => Promise<void>
      checkForUpdates: () => Promise<void>
      onUpdateAvailable: (cb: (version: string) => void) => void
      onUpdateProgress: (cb: (percent: number) => void) => void
      onTriggerUpdateCheck: (cb: () => void) => void
    }
  }
}

export const isElectron = (): boolean =>
  typeof window !== 'undefined' && !!window.electronAPI

export const electronAPI = () => window.electronAPI
