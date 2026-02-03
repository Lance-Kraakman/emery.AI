import React from 'react'
import { Metadata } from 'next'
import { ThemeProvider } from '@/components/ThemeProvider'
import AnimatedBackground from '@/app/components/AnimatedBackground'

export const metadata: Metadata = {
  title: 'Sign In - enhancd.ai',
  description: 'Sign in to your enhancd.ai account',
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
      themes={["light", "dark", "enhancd-light", "enhancd-dark", "system"]}
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