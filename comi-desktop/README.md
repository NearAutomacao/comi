# COMI Desktop — App Windows

Electron app que empacota o sistema COMI para rodar localmente no restaurante.

## Pré-requisitos

- Node.js 20+
- Windows 10/11 64-bit

## Desenvolvimento

```bash
cd comi-desktop
npm install

# Na raiz do projeto comi, build o Next.js primeiro:
cd ..
npm run build

# Volte e rode o Electron:
cd comi-desktop
npm run dev
```

## Build do instalador (.exe)

```bash
# Na raiz do projeto comi:
npm run build

# No comi-desktop:
cd comi-desktop
npm install
npm run dist
```

O instalador será gerado em `comi-desktop/dist/COMI Setup x.x.x.exe`.

## Auto-Update

O app verifica atualizações automaticamente 10 segundos após iniciar.

Para publicar uma nova versão:
1. Incremente a versão em `comi-desktop/package.json`
2. Faça o build: `npm run dist`
3. Crie uma release no GitHub com os artefatos gerados em `dist/`
4. O app dos clientes detectará a nova versão e fará o download silencioso
5. Na próxima vez que o gerente fechar o app, ele é atualizado automaticamente

## Configuração do GitHub Releases

Em `package.json > build > publish`, configure:
```json
{
  "provider": "github",
  "owner": "SEU_USUARIO",
  "repo": "comi-releases"
}
```

Crie um token GitHub com permissão `repo` e exporte:
```bash
export GH_TOKEN=ghp_...
npm run dist
```

## Configuração das impressoras

Ao instalar, o gerente deve configurar os IPs das impressoras no painel admin:
- Vá em Admin → Configurações → Impressoras
- Informe o IP de cada impressora na rede local

## Estrutura

```
src/
  main.ts      # Processo principal do Electron
  preload.ts   # Bridge segura entre Electron e Next.js
  updater.ts   # Lógica de auto-update (electron-updater)
assets/
  icon.ico     # Ícone do app (256x256)
  tray.ico     # Ícone da bandeja do sistema (16x16 ou 32x32)
```
