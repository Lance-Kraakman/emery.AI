import React from 'react'
import AnimatedBackground from '@/src/app/components/AnimatedBackground'
import { EmeryProviders } from '@/src/components/EmeryProviders'

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
      </EmeryProviders>
    </>
  )
}