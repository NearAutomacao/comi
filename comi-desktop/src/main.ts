import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, dialog } from 'electron'
import log from 'electron-log'
import * as path from 'path'
import * as fs from 'fs'
import * as http from 'http'
import { spawn, ChildProcess } from 'child_process'
import { setupUpdater } from './updater'
import { startPrintAgent, stopPrintAgent, updatePrinterConfig } from './print-agent'

log.transports.file.level = 'info'
// Desabilita console em produção — stdout não existe quando app é instalado (EPIPE)
log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : false
log.info('COMI Desktop iniciando...')

const PORT = 3100
const APP_URL = `http://localhost:${PORT}`
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow: BrowserWindow | null = null
let nextServer: ChildProcess | null = null
let tray: Tray | null = null

// ──────────────────────────────────────────
// Config persistida em userData
// ──────────────────────────────────────────
interface AppConfig {
  restaurantId?: string
}

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'config.json')
}

function loadConfig(): AppConfig {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf8')
    return JSON.parse(raw) as AppConfig
  } catch {
    return {}
  }
}

function saveConfig(config: AppConfig): void {
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf8')
}

// ──────────────────────────────────────────
// Servidor Next.js (standalone)
// ──────────────────────────────────────────
function startNextServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isDev) {
      log.info('[server] Modo dev — Next.js já deve estar rodando')
      resolve()
      return
    }

    // standalone output é extraído diretamente em resources/app/
    const appDir = path.join(process.resourcesPath, 'app')
    const serverScript = path.join(appDir, 'server.js')

    log.info('[server] Iniciando Next.js:', serverScript)

    nextServer = spawn(process.execPath, [serverScript], {
      env: {
        ...process.env,
        PORT: String(PORT),
        HOSTNAME: '127.0.0.1',
        NODE_ENV: 'production',
      },
      cwd: appDir,
    })

    nextServer.stdout?.on('data', data => log.info('[next]', String(data).trim()))
    nextServer.stderr?.on('data', data => log.warn('[next]', String(data).trim()))

    nextServer.on('error', err => {
      log.error('[server] Erro ao iniciar Next.js:', err)
      reject(err)
    })

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
// Verificação de licença
// ──────────────────────────────────────────
async function checkLicense(restaurantId: string): Promise<{ valid: boolean; reason?: string }> {
  return new Promise(resolve => {
    http.get(`${APP_URL}/api/license?restaurantId=${restaurantId}`, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve({ valid: true }) }
      })
    }).on('error', () => resolve({ valid: true, reason: 'offline_grace' }))
  })
}

// ──────────────────────────────────────────
// Janela principal
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

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.once('did-finish-load', () => {
    if (!isDev) setupUpdater(mainWindow!)
  })
}

// ──────────────────────────────────────────
// Bandeja do sistema
// ──────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'tray.ico')
  tray = new Tray(nativeImage.createFromPath(iconPath))

  const menu = Menu.buildFromTemplate([
    { label: 'Abrir COMI', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Verificar atualizações', click: () => mainWindow?.webContents.send('trigger-update-check') },
    { type: 'separator' },
    { label: 'Sair', click: () => app.quit() },
  ])

  tray.setToolTip('COMI — Sistema de Gestão')
  tray.setContextMenu(menu)
  tray.on('double-click', () => mainWindow?.show())
}

// ──────────────────────────────────────────
// IPC
// ──────────────────────────────────────────
ipcMain.handle('app-version', () => app.getVersion())
ipcMain.handle('open-external', (_, url: string) => shell.openExternal(url))

// Chamado pelo Next.js quando o gerente faz login no admin
ipcMain.handle('set-restaurant-config', async (_, { restaurantId, printerConfig }: {
  restaurantId: string
  printerConfig?: { kitchenHost: string; kitchenPort: number; barHost: string; barPort: number }
}) => {
  log.info('[ipc] set-restaurant-config:', restaurantId)

  const config = loadConfig()
  config.restaurantId = restaurantId
  saveConfig(config)

  if (printerConfig) {
    updatePrinterConfig(printerConfig)
  }

  await startPrintAgent(restaurantId)
  return { ok: true }
})

// ──────────────────────────────────────────
// Lifecycle
// ──────────────────────────────────────────
app.whenReady().then(async () => {
  try {
    await startNextServer()
    createWindow()
    createTray()

    // Retoma o agente de impressão se restaurante já foi configurado
    const config = loadConfig()
    if (config.restaurantId) {
      log.info('[startup] Retomando print agent para restaurante', config.restaurantId)
      startPrintAgent(config.restaurantId).catch(err =>
        log.error('[startup] Erro ao iniciar print agent:', err)
      )
    }
  } catch (err) {
    log.error('Falha ao iniciar:', err)
    dialog.showErrorBox('Erro ao iniciar COMI', String(err))
    app.quit()
  }
})

app.on('window-all-closed', () => {
  // Windows: mantém na bandeja ao fechar a janela
})

app.on('activate', () => {
  if (mainWindow === null) createWindow()
})

app.on('before-quit', () => {
  stopPrintAgent()
  if (nextServer) {
    log.info('[server] Encerrando Next.js...')
    nextServer.kill()
  }
})
