import './globals.css'
import AuthProvider from '@/components/AuthProvider'
import { Metadata } from 'next'

// AIDEV-NOTE: Force dynamic rendering to prevent Html import issues during Docker builds
export const dynamic = 'force-dynamic'
export const revalidate = 0

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
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="relative h-full">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
