'use client'

import { useEffect, useState } from 'react'
import { isElectron, electronAPI } from '@/lib/electron'
import { toast } from 'sonner'
import { Download, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function UpdateNotifier() {
  const [downloadingVersion, setDownloadingVersion] = useState<string | null>(null)
  const [readyVersion, setReadyVersion] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)

  useEffect(() => {
    if (!isElectron()) return

    const api = electronAPI()!

    api.onUpdateAvailable(version => {
      setDownloadingVersion(version)
      toast('Nova versão disponível', {
        description: `COMI v${version} está sendo baixado...`,
        icon: <Download size={16} />,
        duration: 6000,
      })
    })

    api.onUpdateProgress(percent => {
      setProgress(Math.round(percent))
    })

    api.onUpdateDownloaded(version => {
      setDownloadingVersion(null)
      setProgress(null)
      setReadyVersion(version)
    })

    api.onTriggerUpdateCheck(() => {
      api.checkForUpdates()
    })
  }, [])

  // Badge fixo após download concluído
  if (readyVersion) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-white border border-green-300 rounded-xl shadow-lg p-3 flex items-center gap-3 text-sm">
        <RefreshCw size={16} className="text-green-600 flex-shrink-0" />
        <div>
          <p className="font-medium text-gray-800">COMI v{readyVersion} pronto</p>
          <p className="text-xs text-gray-400 mt-0.5">Reinicie para aplicar a atualização</p>
        </div>
        <Button
          size="sm"
          className="ml-1 bg-green-600 hover:bg-green-700 text-white text-xs h-7 px-2"
          onClick={() => electronAPI()?.quitAndInstall()}
        >
          Reiniciar
        </Button>
      </div>
    )
  }

  // Barra de progresso durante download
  if (!downloadingVersion || progress === null) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border border-orange-200 rounded-xl shadow-lg p-3 flex items-center gap-3 text-sm">
      <Download size={16} className="text-orange-500 flex-shrink-0" />
      <div>
        <p className="font-medium text-gray-800">Baixando v{downloadingVersion}</p>
        <div className="w-48 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{progress}% — não feche o app</p>
      </div>
    </div>
  )
}
