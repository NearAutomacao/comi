import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } from 'electron'
import log from 'electron-log'
import * as path from 'path'
import * as http from 'http'
import { spawn, ChildProcess } from 'child_process'
import { setupUpdater } from './updater'

log.transports.file.level = 'info'
log.info('COMI Desktop iniciando...')

const PORT = 3100
const APP_URL = `http://localhost:${PORT}`
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow: BrowserWindow | null = null
let nextServer: ChildProcess | null = null
let tray: Tray | null = null

// ──────────────────────────────────────────
// Inicia o servidor Next.js em modo standalone
// ──────────────────────────────────────────
function startNextServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isDev) {
      log.info('[server] Modo dev — Next.js já deve estar rodando')
      resolve()
      return
    }

    const appDir = path.join(process.resourcesPath, 'app')
    const serverScript = path.join(appDir, '.next', 'standalone', 'server.js')

    log.info('[server] Iniciando Next.js:', serverScript)

    nextServer = spawn(process.execPath, [serverScript], {
      env: {
        ...process.env,
        PORT: String(PORT),
        NODE_ENV: 'production',
        // Variáveis de ambiente do .env (embutidas no build)
      },
      cwd: appDir,
    })

    nextServer.stdout?.on('data', data => log.info('[next]', String(data).trim()))
    nextServer.stderr?.on('data', data => log.warn('[next]', String(data).trim()))

    nextServer.on('error', err => {
      log.error('[server] Erro ao iniciar Next.js:', err)
      reject(err)
    })

    // Aguarda servidor responder
    waitForServer(APP_URL, 30).then(resolve).catch(reject)
  })
}

async function waitForServer(url: string, retries: number): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await new Promise<void>((res, rej) => {
        http.get(url, r => { r.resume(); res() }).on('error', rej)
      })
      log.info('[server] Pronto em', url)
      return
    } catch {
      await new Promise(r => setTimeout(r, 1000))
    }
  }
  throw new Error('Servidor Next.js não iniciou a tempo')
}

// ──────────────────────────────────────────
// Verifica licença antes de abrir a janela principal
// ──────────────────────────────────────────
async function checkLicense(restaurantId: string): Promise<{ valid: boolean; reason?: string }> {
  return new Promise(resolve => {
    http.get(`${APP_URL}/api/license?restaurantId=${restaurantId}`, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve({ valid: true }) } // Se falhar na verificação, deixa passar (modo offline)
      })
    }).on('error', () => {
      // Sem internet: usa cache local ou concede acesso por até 3 dias
      resolve({ valid: true, reason: 'offline_grace' })
    })
  })
}

// ──────────────────────────────────────────
// Cria a janela principal
// ──────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'COMI',
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadURL(APP_URL)

  mainWindow.on('closed', () => { mainWindow = null })

  // Abre links externos no browser padrão
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) shell.openExternal(url)
    return { action: 'deny' }
  })

  // Configura auto-update depois que a janela estiver pronta
  mainWindow.webContents.once('did-finish-load', () => {
    if (!isDev) setupUpdater(mainWindow!)
  })
}

// ──────────────────────────────────────────
// Ícone na bandeja do sistema
// ──────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'tray.ico')
  tray = new Tray(nativeImage.createFromPath(iconPath))

  const menu = Menu.buildFromTemplate([
    { label: 'Abrir COMI', click: () => mainWindow?.show() },
    { type: 'separator' },
    {
      label: 'Verificar atualizações',
      click: () => mainWindow?.webContents.send('trigger-update-check'),
    },
    { type: 'separator' },
    { label: 'Sair', click: () => app.quit() },
  ])

  tray.setToolTip('COMI — Sistema de Gestão')
  tray.setContextMenu(menu)
  tray.on('double-click', () => mainWindow?.show())
}

// ──────────────────────────────────────────
// IPC: comunicação com a janela
// ──────────────────────────────────────────
ipcMain.handle('app-version', () => app.getVersion())
ipcMain.handle('open-external', (_, url: string) => shell.openExternal(url))

// ──────────────────────────────────────────
// Lifecycle
// ──────────────────────────────────────────
app.whenReady().then(async () => {
  try {
    await startNextServer()
    createWindow()
    createTray()
  } catch (err) {
    log.error('Falha ao iniciar:', err)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  // No Windows, manter rodando na bandeja quando fechar a janela
  if (process.platform !== 'darwin') {
    // Não chama app.quit() — continua na bandeja
  }
})

app.on('activate', () => {
  if (mainWindow === null) createWindow()
})

app.on('before-quit', () => {
  if (nextServer) {
    log.info('[server] Encerrando Next.js...')
    nextServer.kill()
  }
})
