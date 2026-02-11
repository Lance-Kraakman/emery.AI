import { useState, useEffect, useRef, useCallback } from 'react'

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

function generateClientDeviceCode(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

interface DeviceFlowState {
  isDeviceFlow: boolean
  deviceCode: string | null
  status: 'idle' | 'polling' | 'success' | 'error' | 'expired'
  error: string | null
}

const POLL_INTERVAL_MS = 2000
const MAX_POLL_ATTEMPTS = 150 // 5 minutes at 2s intervals
const STORAGE_KEY = 'emery_device_code'

export function useDeviceFlow() {
  const [state, setState] = useState<DeviceFlowState>({
    isDeviceFlow: false,
    deviceCode: null,
    status: 'idle',
    error: null,
  })
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const attemptRef = useRef(0)

  useEffect(() => {
    if (!isTauri()) return

    let code = localStorage.getItem(STORAGE_KEY)
    if (!code) {
      code = generateClientDeviceCode()
      localStorage.setItem(STORAGE_KEY, code)
    }

    setState((prev) => ({
      ...prev,
      isDeviceFlow: true,
      deviceCode: code,
    }))
  }, [])

  const getDeviceCallbackUrl = useCallback(
    (baseCallbackUrl: string = '/apps'): string => {
      if (!state.isDeviceFlow || !state.deviceCode) return baseCallbackUrl

      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      return `${origin}/auth/device-callback?device_code=${state.deviceCode}`
    },
    [state.isDeviceFlow, state.deviceCode]
  )

  const startPolling = useCallback(() => {
    if (!state.deviceCode) return
    if (pollRef.current) return

    attemptRef.current = 0
    setState((prev) => ({ ...prev, status: 'polling' }))

    pollRef.current = setInterval(async () => {
      attemptRef.current += 1

      if (attemptRef.current > MAX_POLL_ATTEMPTS) {
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = null
        localStorage.removeItem(STORAGE_KEY)
        setState((prev) => ({
          ...prev,
          status: 'expired',
          error: 'Sign-in timed out. Please try again.',
        }))
        return
      }

      try {
        const res = await fetch(
          `/api/auth/device/verify?code=${state.deviceCode}`,
          { credentials: 'include' }
        )

        if (res.status === 200) {
          if (pollRef.current) clearInterval(pollRef.current)
          pollRef.current = null
          localStorage.removeItem(STORAGE_KEY)

          // Extract and store API key for Tauri Rust commands
          try {
            const data = await res.json()
            if (data.apiKey && isTauri()) {
              const { invoke } = await import('@tauri-apps/api/core')
              await invoke('store_api_key', { apiKey: data.apiKey })
            }
          } catch (err) {
            console.error('[Device Flow] Failed to store API key:', err)
            // Continue anyway - sync features may not work but auth will
          }

          setState((prev) => ({ ...prev, status: 'success' }))

          setTimeout(() => {
            window.location.href = '/mission-control/dashboard'
          }, 500)
          return
        }

        if (res.status === 202) {
          return // still pending
        }

        // Error
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = null
        const body = await res.json().catch(() => ({}))
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: body.message || 'Authentication failed',
        }))
      } catch {
        // Network error - keep polling
      }
    }, POLL_INTERVAL_MS)
  }, [state.deviceCode])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    stopPolling()
    const newCode = generateClientDeviceCode()
    localStorage.setItem(STORAGE_KEY, newCode)
    setState({
      isDeviceFlow: true,
      deviceCode: newCode,
      status: 'idle',
      error: null,
    })
  }, [stopPolling])

  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  return {
    ...state,
    getDeviceCallbackUrl,
    startPolling,
    stopPolling,
    reset,
  }
}
