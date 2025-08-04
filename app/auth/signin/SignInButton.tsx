"use client"

import { signIn } from "next-auth/react"

interface SignInButtonProps {
  provider: "github" | "google"
}

export function SignInButton({ provider }: SignInButtonProps) {
  const handleSignIn = () => {
    signIn(provider, { callbackUrl: "/dashboard" })
  }

  const buttonConfig = {
    github: {
      text: "Sign in with GitHub",
      className: "group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
    },
    google: {
      text: "Sign in with Google", 
      className: "group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
    }
  }

  const config = buttonConfig[provider]

  return (
    <button
      onClick={handleSignIn}
      className={config.className}
    >
      {config.text}
    </button>
  )
}