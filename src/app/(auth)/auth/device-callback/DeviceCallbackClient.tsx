'use client'

import { CheckCircle2, AlertCircle } from 'lucide-react'

interface DeviceCallbackClientProps {
  status: 'success' | 'error'
  message?: string
}

export function DeviceCallbackClient({ status, message }: DeviceCallbackClientProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          {status === 'success' ? (
            <>
              <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 mb-4">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Sign-in Successful</h1>
              <p className="mt-2 text-muted-foreground">
                You can now return to the Emery desktop app.
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                You can close this browser tab.
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 mb-4">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Sign-in Error</h1>
              <p className="mt-2 text-muted-foreground">
                {message || 'Something went wrong. Please try again from the desktop app.'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
