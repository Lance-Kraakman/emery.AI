import './globals.css'
import AuthProvider from '@/components/AuthProvider'

// Initialize agent scheduler on server startup
import '@/lib/scheduler'
import AnimatedBackground from './components/AnimatedBackground'
import { Metadata } from 'next'

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
    <html lang="en">
      <body className="relative">
        <AnimatedBackground />
        <AuthProvider>
          <div className="relative z-10">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}
