'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

const PULL_TRIGGER = 80

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [pullDist, setPullDist] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const startYRef = useRef(0)
  const rawDistRef = useRef(0)

  const onTouchStart = useCallback((e: TouchEvent) => {
    if ((mainRef.current?.scrollTop ?? 0) > 2) return
    startYRef.current = e.touches[0].clientY
    rawDistRef.current = 0
  }, [])

  const onTouchMove = useCallback((e: TouchEvent) => {
    if ((mainRef.current?.scrollTop ?? 0) > 2) return
    const dist = e.touches[0].clientY - startYRef.current
    if (dist <= 0) return
    rawDistRef.current = dist
    setPullDist(Math.min(dist * 0.5, 56))
  }, [])

  const onTouchEnd = useCallback(() => {
    if (rawDistRef.current >= PULL_TRIGGER) {
      setRefreshing(true)
      router.refresh()
      setTimeout(() => {
        setRefreshing(false)
        setPullDist(0)
      }, 1200)
    } else {
      setPullDist(0)
    }
    rawDistRef.current = 0
  }, [router])

  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [onTouchStart, onTouchMove, onTouchEnd])

  const showIndicator = pullDist > 4 || refreshing

  // No mobile o header é fixo com h-14 (56px), então o indicador usa top-14.
  // O translateY começa negativo (-48px) para ficar escondido atrás do header
  // e vai aumentando conforme o usuário puxa, aparecendo abaixo do header.
  const translateY = refreshing ? 8 : Math.min(pullDist - 48, 8)

  return (
    <main
      ref={mainRef}
      className="flex-1 overflow-auto min-h-0 overscroll-y-none relative pt-14 md:pt-0 pb-16 md:pb-0"
    >
      {/* Indicador PTR — fica atrás do header até pullDist ≥ 48 */}
      <div
        aria-hidden
        className="absolute left-0 right-0 flex justify-center pointer-events-none z-40 top-14 md:top-0"
        style={{
          opacity: showIndicator ? 1 : 0,
          transform: `translateY(${translateY}px)`,
          transition: refreshing
            ? 'opacity 0.15s'
            : 'transform 0.1s ease-out, opacity 0.15s',
        }}
      >
        <div className="bg-white shadow-md rounded-full p-2.5 border border-gray-200">
          <RefreshCw
            className={`h-4 w-4 text-orange-500 ${refreshing ? 'animate-spin' : ''}`}
          />
        </div>
      </div>

      <div className="p-3 sm:p-6 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-6">
        {children}
      </div>
    </main>
  )
}
