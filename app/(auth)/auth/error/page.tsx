"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams?.get("error")

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case "Configuration":
        return "There was an error with the authentication configuration."
      case "AccessDenied":
        return "Access was denied. You may not have permission to sign in."
      case "Verification":
        return "The verification link was invalid or has expired."
      default:
        return "An unknown error occurred during authentication."
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 mb-4">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Authentication Error</h1>
          <p className="mt-2 text-muted-foreground">
            {getErrorMessage(error || null)}
          </p>
        </div>
        
        <div className="bg-card border border-border rounded-lg shadow-sm p-6">
          <Button asChild className="w-full">
            <Link href="/auth/signin">
              Try again
            </Link>
          </Button>
          
          <div className="mt-4 text-center">
            <Link 
              href="/mission-control" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Go to dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AuthError() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-muted-foreground">Loading...</div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  )
}