'use client'

import QRCode from 'react-qr-code'
import { useState } from 'react'
import { Copy, Check, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  url: string
  label: string
  description: string
  highlight?: boolean
}

export default function QRCodeCard({ url, label, description, highlight }: Props) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handlePrint() {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`
      <html><head><title>QR Code — ${label}</title>
      <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;gap:16px}
      p{font-size:14px;color:#555;max-width:300px;text-align:center}</style></head>
      <body>
        <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">${document.getElementById('qr-' + btoa(url).slice(0,8))?.innerHTML ?? ''}</svg>
        <p>${url}</p>
      </body></html>
    `)
    w.document.close()
    w.print()
  }

  return (
    <div className={`rounded-xl border p-6 flex flex-col items-center gap-4 w-full max-w-xs shadow-sm ${
      highlight ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white'
    }`}>
      <span className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
        highlight ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
      }`}>{label}</span>

      <div id={`qr-${btoa(url).slice(0, 8)}`} className="bg-white p-3 rounded-lg">
        <QRCode value={url} size={200} />
      </div>

      <p className="text-xs text-gray-500 text-center break-all">{description}</p>

      <div className="flex gap-2 w-full">
        <Button variant="outline" size="sm" className="flex-1" onClick={handleCopy}>
          {copied ? <Check size={14} className="mr-1 text-green-500" /> : <Copy size={14} className="mr-1" />}
          {copied ? 'Copiado' : 'Copiar link'}
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer size={14} />
        </Button>
      </div>
    </div>
  )
}
