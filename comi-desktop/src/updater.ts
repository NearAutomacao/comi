import { autoUpdater } from 'electron-updater'
import log from 'electron-log'
import { BrowserWindow, dialog, ipcMain, app } from 'electron'

autoUpdater.logger = log
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

let _window: BrowserWindow | null = null
let _manualCheck = false

export function setupUpdater(mainWindow: BrowserWindow) {
  _window = mainWindow

  autoUpdater.on('checking-for-update', () => {
    log.info('[updater] Verificando atualizações...')
  })

  autoUpdater.on('update-available', info => {
    log.info('[updater] Nova versão disponível:', info.version)
    mainWindow.webContents.send('update-available', info.version)
    if (_manualCheck) {
      _manualCheck = false
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Atualização encontrada',
        message: `COMI v${info.version} está disponível.`,
        detail: 'Baixando em segundo plano. Você será avisado quando estiver pronto.',
        buttons: ['OK'],
      })
    }
  })

  autoUpdater.on('update-not-available', () => {
    log.info('[updater] Nenhuma atualização disponível.')
    if (_manualCheck) {
      _manualCheck = false
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'COMI está atualizado',
        message: `Você já tem a versão mais recente (v${app.getVersion()}).`,
        buttons: ['OK'],
      })
    }
  })

  autoUpdater.on('download-progress', progress => {
    mainWindow.webContents.send('update-progress', progress.percent)
    log.info(`[updater] Baixando: ${Math.round(progress.percent)}%`)
  })

  autoUpdater.on('update-downloaded', info => {
    log.info('[updater] Download concluído:', info.version)
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Atualização pronta',
      message: `COMI v${info.version} foi baixado e está pronto para instalar.`,
      detail: 'Reinicie agora para aplicar, ou será instalado na próxima vez que fechar o app.',
      buttons: ['Reiniciar agora', 'Depois'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall()
    })
  })

  autoUpdater.on('error', err => {
    log.error('[updater] Erro:', err)
    if (_manualCheck) {
      _manualCheck = false
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Erro ao verificar atualizações',
        message: 'Não foi possível verificar atualizações.',
        detail: String(err),
        buttons: ['OK'],
      })
    }
  })

  ipcMain.handle('check-for-updates', () => checkManually())

  // Verifica automaticamente 10s após iniciar
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(err => log.warn('[updater] Verificação automática falhou:', err))
  }, 10_000)
}

export function checkManually() {
  _manualCheck = true
  if (_window && !_window.isDestroyed()) {
    autoUpdater.checkForUpdates().catch(err => {
      _manualCheck = false
      log.warn('[updater] Verificação manual falhou:', err)
      dialog.showMessageBox(_window!, {
        type: 'error',
        title: 'Erro ao verificar atualizações',
        message: 'Não foi possível se conectar ao servidor de atualizações.',
        detail: String(err),
        buttons: ['OK'],
      })
    })
  }
}
