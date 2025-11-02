import React from 'react'
import { Toaster } from 'sonner'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

// Minimal layout for preview routes - no sidebar, no chat, just authentication
export default async function PreviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  // Require authentication
  if (!session?.user) {
    redirect('/auth/signin')
  }

  return (
    <div key="preview-layout" className="h-screen w-screen bg-white">
      {children}
      <Toaster position="bottom-right" />
    </div>
  )
}
