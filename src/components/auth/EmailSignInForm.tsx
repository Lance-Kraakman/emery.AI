'use client'

import React, { useState } from "react"
import { signIn } from "next-auth/react"
import { useDeviceFlow } from "@/hooks/useDeviceFlow"

interface EmailSignInFormProps {
  callbackUrl?: string
  // Theme overrides
  buttonColor?: string
  buttonTextColor?: string
  borderColor?: string
  borderRadius?: string
  textColor?: string
  // Sign-up mode changes button text
  isSignUp?: boolean
  // Default role ID for sign-up mode
  signUpRoleId?: number
}

export function EmailSignInForm({
  callbackUrl = "/apps",
  buttonColor,
  buttonTextColor,
  borderColor,
  borderRadius,
  textColor,
  isSignUp = false,
  signUpRoleId
}: EmailSignInFormProps) {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const deviceFlow = useDeviceFlow()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage("")

    // If signUpRoleId is provided, append it to the callback URL
    let finalCallbackUrl = callbackUrl;
    if (signUpRoleId && typeof window !== 'undefined') {
      const url = new URL(callbackUrl, window.location.origin);
      url.searchParams.set('signupRole', String(signUpRoleId));
      finalCallbackUrl = url.pathname + url.search;
    }

    try {
      const result = await signIn("email", {
        email,
        redirect: false,
        callbackUrl: deviceFlow.isDeviceFlow
          ? deviceFlow.getDeviceCallbackUrl(finalCallbackUrl)
          : finalCallbackUrl,
      })

      if (result?.ok) {
        setMessage("Check your email for a sign-in link.")
        if (deviceFlow.isDeviceFlow) {
          deviceFlow.startPolling()
        }
      } else {
        setMessage(result?.error || "An error occurred. Please try again.")
      }
    } catch (error) {
      console.error("Sign-in error:", error)
      setMessage("An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="email"
        name="email"
        placeholder="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="w-full px-3 py-2 text-sm transition-colors"
        style={{
          backgroundColor: 'var(--theme-background, #ffffff)',
          color: textColor || 'var(--theme-text, #1e293b)',
          borderRadius: borderRadius || 'var(--theme-border-radius, 0.5rem)',
          border: borderColor ? `1px solid ${borderColor}` : '1px solid var(--theme-border, #e2e8f0)',
        }}
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-50"
        style={{
          backgroundColor: buttonColor || 'var(--theme-primary, #2563eb)',
          color: buttonTextColor || '#ffffff',
          borderRadius: borderRadius || 'var(--theme-border-radius, 0.5rem)',
          border: borderColor ? `1px solid ${borderColor}` : 'none',
        }}
      >
        {loading ? "Sending..." : isSignUp ? "Sign up with Email" : "Sign in with Email"}
      </button>
      {message && (
        <p
          className="text-sm text-center mt-2"
          style={{ color: 'var(--theme-text-muted, #64748b)' }}
        >
          {message}
        </p>
      )}
      {deviceFlow.status === 'polling' && (
        <p className="text-sm text-center mt-2" style={{ color: 'var(--theme-text-muted, #64748b)' }}>
          Waiting for sign-in from your email...
        </p>
      )}
      {deviceFlow.status === 'success' && (
        <p className="text-sm text-center mt-2" style={{ color: '#22c55e' }}>
          Sign-in successful! Redirecting...
        </p>
      )}
      {deviceFlow.status === 'expired' && (
        <div className="text-sm text-center mt-2">
          <p style={{ color: '#ef4444' }}>{deviceFlow.error}</p>
          <button
            type="button"
            onClick={deviceFlow.reset}
            className="mt-1 underline"
            style={{ color: 'var(--theme-text-muted, #64748b)' }}
          >
            Try again
          </button>
        </div>
      )}
    </form>
  )
}
