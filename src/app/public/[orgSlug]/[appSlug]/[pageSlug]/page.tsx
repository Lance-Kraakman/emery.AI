// AIDEV-NOTE: Public page renderer for published Puck pages
// No authentication required - renders public pages

import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getPublicApp, getPublicPage } from "@/app/actions/public-pages"
import { PublicPageRenderer } from "./PublicPageRenderer"

interface PublicPageProps {
  params: Promise<{
    orgSlug: string
    appSlug: string
    pageSlug: string
  }>
}

export async function generateMetadata({
  params
}: PublicPageProps): Promise<Metadata> {
  const { orgSlug, appSlug, pageSlug } = await params

  const pageResult = await getPublicPage(
    orgSlug,
    appSlug,
    pageSlug
  )

  if (!pageResult.success || !pageResult.data) {
    return {
      title: "Page Not Found"
    }
  }

  const page = pageResult.data

  return {
    title: page.name,
    description: page.description || undefined
  }
}

export default async function PublicPage({ params }: PublicPageProps) {
  const { orgSlug, appSlug, pageSlug } = await params

  // Fetch app and page data
  const [appResult, pageResult] = await Promise.all([
    getPublicApp(orgSlug, appSlug),
    getPublicPage(orgSlug, appSlug, pageSlug)
  ])

  if (!appResult.success || !appResult.data || !pageResult.success || !pageResult.data) {
    notFound()
  }

  const app = appResult.data
  const page = pageResult.data

  // TODO: Check requiresAuth and allowedRoles (Phase 2)
  // For now, just render public pages without auth checks

  return (
    <PublicPageRenderer
      page={page}
      app={app}
    />
  )
}
