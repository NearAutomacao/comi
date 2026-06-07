import { autoUpdater } from 'electron-updater'
import log from 'electron-log'
import { BrowserWindow, dialog, ipcMain } from 'electron'

autoUpdater.logger = log
autoUpdater.autoDownload = true        // baixa silenciosamente
autoUpdater.autoInstallOnAppQuit = true // instala ao fechar

export function setupUpdater(mainWindow: BrowserWindow) {
  // Notifica progresso de download para a janela
  autoUpdater.on('download-progress', progress => {
    mainWindow.webContents.send('update-progress', progress.percent)
  })

  // Quando nova versão é encontrada
  autoUpdater.on('update-available', info => {
    log.info('Nova versão disponível:', info.version)
    mainWindow.webContents.send('update-available', info.version)
  })

  // Quando download termina — pergunta se pode reiniciar
  autoUpdater.on('update-downloaded', info => {
    log.info('Atualização baixada:', info.version)
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Atualização disponível',
      message: `COMI v${info.version} está pronto para instalar.`,
      detail: 'Reinicie o aplicativo agora para aplicar a atualização.',
      buttons: ['Reiniciar agora', 'Mais tarde'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall()
    })
  })

  autoUpdater.on('error', err => {
    log.error('Erro no auto-update:', err)
  })

  // IPC: verificação manual de atualização (botão na UI)
  ipcMain.handle('check-for-updates', () => autoUpdater.checkForUpdates())

  // Verifica ao iniciar (delay de 10s para não atrapalhar o carregamento)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(err => log.warn('Verificação de update falhou:', err))
  }, 10_000)
}
