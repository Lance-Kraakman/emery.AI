'use client'

import React, { useState } from "react"
import { signIn } from "next-auth/react"

interface EmailSignInFormProps {
  callbackUrl?: string
  // Theme overrides
  buttonColor?: string
  buttonTextColor?: string
  borderColor?: string
  borderRadius?: string
  textColor?: string
}

export function EmailSignInForm({
  callbackUrl = "/mission-control",
  buttonColor,
  buttonTextColor,
  borderColor,
  borderRadius,
  textColor
}: EmailSignInFormProps) {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage("")

    try {
      const result = await signIn("email", {
        email,
        redirect: false,
        callbackUrl,
      })

      if (result?.ok) {
        setMessage("Check your email for a sign-in link.")
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
        {loading ? "Sending..." : "Sign in with Email"}
      </button>
      {message && (
        <p
          className="text-sm text-center mt-2"
          style={{ color: 'var(--theme-text-muted, #64748b)' }}
        >
          {message}
        </p>
      )}
    </form>
  )
}
