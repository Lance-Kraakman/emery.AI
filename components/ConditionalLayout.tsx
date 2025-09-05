'use client'

import { usePathname } from 'next/navigation'
import { EmeryProviders } from '@/components/EmeryProviders'
import AnimatedBackground from '@/app/components/AnimatedBackground'

interface ConditionalLayoutProps {
  children: React.ReactNode
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname()
  
  // Check if we're on an auth route
  const isAuthRoute = pathname.startsWith('/auth')
  
  // For auth routes, just return children (they have their own layout)
  if (isAuthRoute) {
    return <>{children}</>
  }
  
  // For all other routes, apply the full app layout with chat/sidebar
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