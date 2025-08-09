import { AIProvider } from './ai'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AIProvider>{children}</AIProvider>
}
