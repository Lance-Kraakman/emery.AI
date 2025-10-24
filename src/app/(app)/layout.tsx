import React from 'react'
import { Toaster } from 'sonner'
import AnimatedBackground from '@/app/components/AnimatedBackground'
import { EmeryProviders } from '@/components/EmeryProviders'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <AnimatedBackground />
      <EmeryProviders>
        <div className="relative z-10 h-full">
          {children}
        </div>
        <Toaster position="bottom-right" />
      </EmeryProviders>
    </>
  )
}