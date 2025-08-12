"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mail, Loader2 } from "lucide-react"

interface EmailSignInFormProps {
  callbackUrl?: string
}

export function EmailSignInForm({ callbackUrl = "/mission-control" }: EmailSignInFormProps) {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setIsLoading(true)
    setMessage("")

    try {
      const result = await signIn("email", {
        email,
        callbackUrl,
        redirect: false
      })

      if (result?.error) {
        setMessage("Failed to send sign-in email. Please try again.")
      } else {
        setMessage("Check your email for a sign-in link!")
      }
    } catch (error) {
      setMessage("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-900">Sign in with Email</h3>
        <p className="text-sm text-gray-600 mt-1">
          Enter your email to receive a sign-in link
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email" className="sr-only">
            Email address
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            disabled={isLoading}
            className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
          />
        </div>
        
        <Button
          type="submit"
          disabled={isLoading || !email}
          className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Mail className="h-4 w-4 mr-2" />
              Send sign-in link
            </>
          )}
        </Button>
      </form>

      {message && (
        <div className={`text-sm text-center p-3 rounded-md ${
          message.includes("Check your email") 
            ? "text-green-700 bg-green-50 border border-green-200" 
            : "text-red-700 bg-red-50 border border-red-200"
        }`}>
          {message}
        </div>
      )}
    </div>
  )
}