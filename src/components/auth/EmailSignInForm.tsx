'use client'

import React, { useState } from "react"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface EmailSignInFormProps {
  callbackUrl?: string
}

export function EmailSignInForm({ callbackUrl = "/mission-control" }: EmailSignInFormProps) {
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        type="email"
        name="email"
        placeholder="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="w-full"
      />
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Sending..." : "Sign in with Email"}
      </Button>
      {message && (
        <p className="text-sm text-center text-muted-foreground mt-2">
          {message}
        </p>
      )}
    </form>
  )
}
