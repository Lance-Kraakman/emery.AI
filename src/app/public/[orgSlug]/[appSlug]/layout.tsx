// AIDEV-NOTE: Layout for public Puck apps
// Provides app-level theme and metadata

import type { Metadata } from "next"
import { getPublicApp } from "@/app/actions/public-pages"
import { notFound } from "next/navigation"

interface PublicAppLayoutProps {
  children: React.ReactNode
  params: {
    orgSlug: string
    appSlug: string
  }
}

export async function generateMetadata({
  params
}: {
  params: { orgSlug: string; appSlug: string }
}): Promise<Metadata> {
  const result = await getPublicApp(params.orgSlug, params.appSlug)

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
  const result = await getPublicApp(params.orgSlug, params.appSlug)

  if (!result.success || !result.data) {
    notFound()
  }

  const app = result.data

  return (
    <div className="min-h-screen">
      {/* App-level theme will be applied via PuckRenderer in page */}
      {children}
    </div>
  )
}
