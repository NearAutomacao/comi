// @ts-nocheck
import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as http from 'http'
import { spawn } from 'child_process'
import log from 'electron-log'

// Requer PocketBase v0.22.x — APIs de admin mudam na v0.23+
const PB_ADMIN_EMAIL = 'admin@comi.local'
const PB_ADMIN_PASSWORD = 'comi_pb_bootstrap_x7k2'

let pbProcess = null

function getPocketBasePath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'pocketbase', 'pocketbase.exe')
  }
  return path.join(__dirname, '..', 'assets', 'pocketbase', 'pocketbase.exe')
}

function getPocketBaseDataDir(): string {
  return path.join(app.getPath('userData'), 'pb_data')
}

function waitForHealth(retries = 30): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const check = () => {
      http.get('http://127.0.0.1:8090/api/health', res => {
        res.resume()
        if (res.statusCode === 200) {
          log.info('[pocketbase] Saudável')
          resolve()
        } else {
          retry()
        }
      }).on('error', retry)
    }
    const retry = () => {
      attempts++
      if (attempts >= retries) { reject(new Error('PocketBase não iniciou a tempo')); return }
      setTimeout(check, 1000)
    }
    check()
  })
}

// Cria collections automaticamente na primeira execução.
// Usa a API de admin do PocketBase v0.22 (POST /api/admins só funciona sem nenhum admin cadastrado).
async function bootstrapSchema(): Promise<void> {
  const schemaPath = path.join(__dirname, '..', 'assets', 'pb_schema.json')
  if (!fs.existsSync(schemaPath)) {
    log.warn('[pocketbase] pb_schema.json não encontrado — pulando bootstrap')
    return
  }

  try {
    // Tenta criar o primeiro admin — retorna erro se já existir algum admin
    const createRes = await fetch('http://127.0.0.1:8090/api/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: PB_ADMIN_EMAIL,
        password: PB_ADMIN_PASSWORD,
        passwordConfirm: PB_ADMIN_PASSWORD,
      }),
    })

    if (!createRes.ok) {
      // Admin já existe = instalação anterior, schema já importado
      log.info('[pocketbase] Bootstrap: admin já existe, schema mantido')
      return
    }
    log.info('[pocketbase] Bootstrap: admin inicial criado')

    // Autentica
    const authRes = await fetch('http://127.0.0.1:8090/api/admins/auth-with-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: PB_ADMIN_EMAIL, password: PB_ADMIN_PASSWORD }),
    })
    const { token } = await authRes.json()

    // Importa o schema
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'))
    const importRes = await fetch('http://127.0.0.1:8090/api/collections/import', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
      },
      body: JSON.stringify({ ...schema, deleteMissing: false }),
    })

    if (importRes.ok) {
      log.info('[pocketbase] Bootstrap: schema importado com sucesso')
    } else {
      log.error('[pocketbase] Bootstrap: falha ao importar schema:', await importRes.text())
    }
  } catch (err) {
    log.error('[pocketbase] Bootstrap: erro:', err)
  }
}

export async function startPocketBase(): Promise<void> {
  const pbPath = getPocketBasePath()
  const dataDir = getPocketBaseDataDir()

  if (!fs.existsSync(pbPath)) {
    log.warn('[pocketbase] Binário não encontrado:', pbPath)
    log.warn('[pocketbase] Baixe pocketbase v0.22.x em https://github.com/pocketbase/pocketbase/releases e coloque em assets/pocketbase/')
    return
  }

  fs.mkdirSync(dataDir, { recursive: true })
  log.info('[pocketbase] Iniciando:', pbPath, '--dir', dataDir)

  pbProcess = spawn(pbPath, ['serve', '--http', '0.0.0.0:8090', '--dir', dataDir], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  pbProcess.stdout?.on('data', (data: Buffer) =>
    log.info('[pb]', data.toString().trim())
  )
  pbProcess.stderr?.on('data', (data: Buffer) =>
    log.warn('[pb]', data.toString().trim())
  )
  pbProcess.on('exit', (code: number) => {
    log.warn('[pocketbase] Processo encerrou com código:', code)
    pbProcess = null
  })

  await waitForHealth()
  await bootstrapSchema()
}

export function stopPocketBase(): void {
  if (pbProcess) {
    log.info('[pocketbase] Encerrando...')
    pbProcess.kill()
    pbProcess = null
  }
}
