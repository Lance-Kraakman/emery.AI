import React from 'react'
import { Metadata } from 'next'
import { ThemeProvider } from '@/src/components/ThemeProvider'
import AnimatedBackground from '@/src/app/components/AnimatedBackground'

export const metadata: Metadata = {
  title: 'Sign In - Emery',
  description: 'Sign in to your Emery account',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <div className="relative min-h-screen">
        <AnimatedBackground />
        <div className="relative z-10 min-h-screen">
          {children}
        </div>
      </div>
    </ThemeProvider>
  )
}