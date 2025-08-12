import './globals.css'
import AuthProvider from '@/components/AuthProvider'

// Initialize agent scheduler on server startup
import '@/lib/scheduler'
import AnimatedBackground from './components/AnimatedBackground'
import { Metadata } from 'next'
import { EmeryProviders } from '@/components/EmeryProviders'

export const metadata: Metadata = {
  title: 'Emery - Dynamic Database Builder',
  description: 'Build dynamic databases with tables, fields, and rows',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className="relative h-full">
        <AnimatedBackground />
        <AuthProvider>
        <EmeryProviders>
          <div className="relative z-10 h-full">
            {children}
          </div>
          </EmeryProviders>
        </AuthProvider>
      </body>
    </html>
  )
}
