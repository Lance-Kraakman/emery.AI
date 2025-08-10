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
      <body className="bg-gray-50 min-h-screen">
        <AnimatedBackground />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
