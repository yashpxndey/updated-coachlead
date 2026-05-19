'use client'
import { useEffect, useState } from 'react'

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowBanner(true)
    })
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const result = await deferredPrompt.userChoice
      if (result.outcome === 'accepted') {
        console.log('User accepted the install prompt')
      }
      setShowBanner(false)
    }
  }

  if (!showBanner) return null

  return (
    <div className="fixed top-4 left-4 right-4 z-[100] bg-teal-600 rounded-xl p-4 flex items-center justify-between shadow-xl">
      <div>
        <p className="text-white font-bold text-sm">Install CoachLead</p>
        <p className="text-teal-100 text-xs">Add to home screen for quick access</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setShowBanner(false)}
          className="text-teal-200 text-sm px-3 py-1"
        >
          Later
        </button>
        <button
          onClick={handleInstall}
          className="bg-white text-teal-600 text-sm font-bold px-3 py-1 rounded-lg"
        >
          Install
        </button>
      </div>
    </div>
  )
}
