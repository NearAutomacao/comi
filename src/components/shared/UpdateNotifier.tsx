'use client'

import { useEffect, useState } from 'react'
import { isElectron, electronAPI } from '@/lib/electron'
import { toast } from 'sonner'
import { Download } from 'lucide-react'

export default function UpdateNotifier() {
  const [updateVersion, setUpdateVersion] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)

  useEffect(() => {
    if (!isElectron()) return

    const api = electronAPI()!

    api.onUpdateAvailable(version => {
      setUpdateVersion(version)
      toast('Nova versão disponível', {
        description: `COMI v${version} está sendo baixado...`,
        icon: <Download size={16} />,
        duration: 6000,
      })
    })

    api.onUpdateProgress(percent => {
      setProgress(Math.round(percent))
    })

    api.onTriggerUpdateCheck(() => {
      api.checkForUpdates()
    })
  }, [])

  if (!updateVersion || progress === null) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border border-orange-200 rounded-xl shadow-lg p-3 flex items-center gap-3 text-sm">
      <Download size={16} className="text-orange-500 flex-shrink-0" />
      <div>
        <p className="font-medium text-gray-800">Atualizando para v{updateVersion}</p>
        <div className="w-48 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{progress}% — instalará ao fechar</p>
      </div>
    </div>
  )
}
