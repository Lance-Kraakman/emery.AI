import { EmeryProviders } from '@/components/EmeryProviders';

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
      <EmeryProviders>
        {children}
      </EmeryProviders>
    )
  }