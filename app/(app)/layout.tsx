import AnimatedBackground from '@/app/components/AnimatedBackground'
import { EmeryProviders } from '@/components/EmeryProviders'

// AIDEV-NOTE: Force server-side rendering to prevent LlamaIndex static generation issues
export const dynamic = 'force-dynamic';

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