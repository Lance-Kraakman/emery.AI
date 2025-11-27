// AIDEV-NOTE: Layout for public Puck apps
// Provides app-level theme, metadata, and authentication context

import type { Metadata } from "next"
import { getPublicApp } from "@/app/actions/public-pages"
import { notFound } from "next/navigation"
import { PublicAppAuthProvider } from "@/components/providers/PublicAppAuthProvider"

interface PublicAppLayoutProps {
  children: React.ReactNode
  params: Promise<{
    orgSlug: string
    appSlug: string
  }>
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ orgSlug: string; appSlug: string }>
}): Promise<Metadata> {
  const { orgSlug, appSlug } = await params

  const result = await getPublicApp(orgSlug, appSlug)

  if (!result.success || !result.data) {
    return {
      title: "App Not Found"
    }
  }

  const app = result.data

  return {
    title: app.name,
    description: app.description || undefined
  }
}

export default async function PublicAppLayout({
  children,
  params
}: PublicAppLayoutProps) {
  const { orgSlug, appSlug } = await params

  const result = await getPublicApp(orgSlug, appSlug)

  if (!result.success || !result.data) {
    notFound()
  }

  const app = result.data

  return (
    <PublicAppAuthProvider
      appId={app.id}
      orgSlug={orgSlug}
      appSlug={appSlug}
    >
      <div className="min-h-screen">
        {/* App-level theme will be applied via PuckRenderer in page */}
        {children}
      </div>
    </PublicAppAuthProvider>
  )
}
