import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, dialog, utilityProcess } from 'electron'
import type { UtilityProcess } from 'electron'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'
import * as path from 'path'
import * as fs from 'fs'
import * as http from 'http'
import { setupUpdater } from './updater'
import { startPrintAgent, stopPrintAgent, updatePrinterConfig } from './print-agent'
import { SUPABASE_URL, SUPABASE_ANON_KEY, MESA_SESSION_SECRET } from './env'

let isQuitting = false

log.transports.file.level = 'info'
// Desabilita console em produção — stdout não existe em app instalado (causa EPIPE)
log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : false
log.info('COMI Desktop iniciando...')

const PORT = 3100
const APP_URL = `http://localhost:${PORT}`
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow: BrowserWindow | null = null
let nextServerProcess: UtilityProcess | null = null
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
// Servidor Next.js (standalone via utilityProcess)
// utilityProcess cria um processo Node.js puro — não Electron completo
// ──────────────────────────────────────────
function startNextServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isDev) {
      log.info('[server] Modo dev — Next.js já deve estar rodando na porta', PORT)
      resolve()
      return
    }

    const appDir = path.join(process.resourcesPath, 'app')
    const serverScript = path.join(appDir, 'server.js')

    log.info('[server] Iniciando via utilityProcess:', serverScript)

    nextServerProcess = utilityProcess.fork(serverScript, [], {
      env: {
        ...process.env,
        PORT: String(PORT),
        HOSTNAME: '127.0.0.1',
        NODE_ENV: 'production',
        // Vars de runtime necessárias para o servidor Next.js standalone
        NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
        MESA_SESSION_SECRET: MESA_SESSION_SECRET,
      },
      cwd: appDir,
      stdio: 'pipe',
    })

    nextServerProcess.stdout?.on('data', (data: Buffer) =>
      log.info('[next]', data.toString().trim())
    )
    nextServerProcess.stderr?.on('data', (data: Buffer) =>
      log.warn('[next]', data.toString().trim())
    )

    nextServerProcess.on('exit', (code: number) => {
      log.warn('[server] utilityProcess encerrou com código:', code)
    })

    waitForServer(APP_URL, 40).then(resolve).catch(reject)
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

  // Desktop app sempre entra no painel admin (redireciona para login se não autenticado)
  mainWindow.loadURL(APP_URL + '/admin')

  // X fecha a janela mas mantém o app na bandeja — não destrói mainWindow
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  // Navegação por teclado: Alt+← volta, Alt+→ avança
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.type !== 'keyDown') return
    if (input.alt && input.key === 'ArrowLeft' && mainWindow?.webContents.canGoBack()) {
      mainWindow.webContents.goBack()
    } else if (input.alt && input.key === 'ArrowRight' && mainWindow?.webContents.canGoForward()) {
      mainWindow.webContents.goForward()
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.once('did-finish-load', () => {
    if (!isDev) setupUpdater(mainWindow!)
  })
}

// ──────────────────────────────────────────
// Utilitário: exibe/restaura a janela principal
// ──────────────────────────────────────────
function showWindow() {
  if (!mainWindow) {
    createWindow()
  } else {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
}

// ──────────────────────────────────────────
// Bandeja do sistema
// ──────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.ico')
  tray = new Tray(nativeImage.createFromPath(iconPath))

  const menu = Menu.buildFromTemplate([
    { label: 'Abrir COMI', click: () => showWindow() },
    { type: 'separator' },
    {
      label: 'Verificar atualizações',
      click: () => {
        autoUpdater.checkForUpdates().catch(err => log.warn('Update check failed:', err))
        showWindow()
      },
    },
    { type: 'separator' },
    { label: 'Sair', click: () => { isQuitting = true; app.quit() } },
  ])

  tray.setToolTip('COMI — Sistema de Gestão')
  tray.setContextMenu(menu)
  tray.on('double-click', () => showWindow())
}

// ──────────────────────────────────────────
// IPC
// ──────────────────────────────────────────
ipcMain.handle('app-version', () => app.getVersion())
ipcMain.handle('open-external', (_, url: string) => shell.openExternal(url))

ipcMain.handle('set-restaurant-config', async (_, { restaurantId, printerConfig }: {
  restaurantId: string
  printerConfig?: { kitchenHost: string; kitchenPort: number; barHost: string; barPort: number }
}) => {
  log.info('[ipc] set-restaurant-config:', restaurantId)
  const config = loadConfig()
  config.restaurantId = restaurantId
  saveConfig(config)
  if (printerConfig) updatePrinterConfig(printerConfig)
  await startPrintAgent(restaurantId)
  return { ok: true }
})

// ──────────────────────────────────────────
// Single instance lock — impede duas janelas no mesmo PC
// ──────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

app.on('second-instance', () => { showWindow() })

// ──────────────────────────────────────────
// Lifecycle
// ──────────────────────────────────────────
app.whenReady().then(async () => {
  // Remove menu padrão (File, Edit, View…) — deve ser chamado após app ready
  Menu.setApplicationMenu(null)

  try {
    await startNextServer()
    createWindow()
    createTray()

    const config = loadConfig()
    if (config.restaurantId) {
      log.info('[startup] Retomando print agent para', config.restaurantId)
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
  isQuitting = true
  stopPrintAgent()
  if (nextServerProcess) {
    log.info('[server] Encerrando Next.js...')
    nextServerProcess.kill()
  }
})
