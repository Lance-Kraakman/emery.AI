import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { SignInButton } from "./SignInButton"
import { EmailSignInForm } from "./EmailSignInForm"
import { Separator } from "@/components/ui/separator"

export default async function SignInPage() {
  const session = await auth()
  
  // if (session) {
  //   redirect("/mission-control")
  // }

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
        
        <div className="mt-8 space-y-6">
          {/* OAuth Providers */}
          <div className="space-y-3">
            <SignInButton provider="github" />
            <SignInButton provider="google" />
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-gray-50 px-2 text-gray-500">
                Or continue with
              </span>
            </div>
          </div>

          <EmailSignInForm />
        </div>
      </div>
    </div>
  )
}
