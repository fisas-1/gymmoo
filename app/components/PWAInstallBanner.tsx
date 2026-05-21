'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '../contexts/LanguageContext'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PWAInstallBanner() {
  const { t } = useTranslation()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Don't show if already dismissed or installed
    if (localStorage.getItem('pwa_banner_dismissed')) return
    if (window.matchMedia('(display-mode: standalone)').matches) return

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window.navigator as any).standalone
    setIsIOS(ios)

    if (ios) {
      // iOS: show manual instructions after a short delay
      const t = setTimeout(() => setShow(true), 3000)
      return () => clearTimeout(t)
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    window.addEventListener('appinstalled', () => {
      setInstalled(true)
      setShow(false)
    })

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    localStorage.setItem('pwa_banner_dismissed', '1')
    setShow(false)
  }

  async function install() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setDeferredPrompt(null)
    setShow(false)
    localStorage.setItem('pwa_banner_dismissed', '1')
  }

  if (!show || installed) return null

  return (
    <div
      className="fixed bottom-[5.5rem] left-4 right-4 z-[9990] rounded-2xl px-4 py-3.5 flex items-start gap-3 shadow-lg"
      style={{
        backgroundColor: 'var(--card)',
        border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        animation: 'dopSlideUp 400ms cubic-bezier(.22,1,.36,1) both',
      }}
    >
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-xl"
        style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)' }}
      >
        📲
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text)] leading-tight">
          {t('pwa.installTitle')}
        </p>
        <p className="font-mono text-[10px] text-[var(--text-3)] mt-0.5 leading-snug">
          {isIOS ? t('pwa.installDescIOS') : t('pwa.installDesc')}
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1.5 flex-shrink-0">
        {!isIOS && (
          <button
            onClick={install}
            className="px-3 py-1.5 rounded-full text-[11px] font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {t('pwa.installBtn')}
          </button>
        )}
        <button
          onClick={dismiss}
          className="px-3 py-1.5 rounded-full text-[11px] font-medium border text-center transition-opacity hover:opacity-80"
          style={{ color: 'var(--text-3)', borderColor: 'var(--rule)' }}
        >
          {t('pwa.dismissBtn')}
        </button>
      </div>
    </div>
  )
}
