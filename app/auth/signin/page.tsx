import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { SignInButton } from "./SignInButton"

export default async function SignInPage() {
  const session = await auth()
  
  if (session) {
    redirect("/")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to Emery
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Dynamic database builder for modern teams
          </p>
        </div>
        <div className="mt-8 space-y-4">
          <SignInButton provider="github" />
          <SignInButton provider="google" />
        </div>
      </div>
    </div>
  )
}