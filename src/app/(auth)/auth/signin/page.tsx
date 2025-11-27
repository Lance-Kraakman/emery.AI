import React from "react"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { SignInButton } from "@/components/auth/SignInButton"
import { EmailSignInForm } from "@/components/auth/EmailSignInForm"
import { Separator } from "@/components/ui/separator"

interface SignInPageProps {
  searchParams: Promise<{
    callbackUrl?: string;
    error?: string;
  }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await auth()
  const params = await searchParams

  // if (session) {
  //   redirect("/mission-control/dashboard")
  // }

  const callbackUrl = params.callbackUrl || '/mission-control/dashboard'

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            Welcome to <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Emery</span>
          </h1>
          <p className="mt-2 text-muted-foreground">
            Dynamic database builder for modern teams
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg shadow-sm p-6 space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-center mb-6">Sign in to your account</h2>

            {/* OAuth Providers */}
            <div className="space-y-3">
              <SignInButton provider="github" callbackUrl={callbackUrl} />
              <SignInButton provider="google" callbackUrl={callbackUrl} />
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or continue with email
                </span>
              </div>
            </div>

            <EmailSignInForm callbackUrl={callbackUrl} />
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account? Contact your organization administrator.
        </p>
      </div>
    </div>
  )
}
