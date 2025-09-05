import './globals.css'
import AuthProvider from '@/components/AuthProvider'
import { ConditionalLayout } from '@/components/ConditionalLayout'
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
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="relative h-full">
        <AuthProvider>
          <ConditionalLayout>
            {children}
          </ConditionalLayout>
        </AuthProvider>
      </body>
    </html>
  )
}
