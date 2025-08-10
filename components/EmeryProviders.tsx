'use client'

import { EmerySidebar } from '@/components/EmerySidebar'
import { Suspense } from 'react'

interface EmeryProvidersProps {
  children: React.ReactNode
}

export function EmeryProviders({ children }: EmeryProvidersProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Suspense fallback={<div className="w-64 bg-card border-r border-border" />}>
        <EmerySidebar />
      </Suspense>
      <main className="flex-1 flex flex-col overflow-hidden bg-background min-h-0">
        {children}
      </main>
    </div>
  )
}