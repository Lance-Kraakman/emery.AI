"use client"

// AIDEV-NOTE: Client component for rendering public Puck pages
// Uses Puck's Render component with app/page theme configuration
// Calls resolveAllData to execute component resolveData functions (e.g., DataBlock filters)

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Render, resolveAllData, type Data } from "@measured/puck"
import "@measured/puck/puck.css"
import { config } from "@/components/puck/config"
import type { PageDTO } from "@/app/mappers/puck-page-mapper"
import type { AppDTO } from "@/app/mappers/puck-app-mapper"
import { ThemeConfig } from "@/ddd/domain/puck/value-objects/theme-config"
import { PageContextProvider } from "@/components/puck/contexts/PageContext"
import { Loading } from "@/components/ui/loading"

interface PublicPageRendererProps {
  page: PageDTO
  app: AppDTO
  orgSlug: string
  appSlug: string
  pages: PageDTO[]
}

/**
 * PublicPageRenderer - Renders a published Puck page
 *
 * Features:
 * - Resolves component data (DataBlock filters, etc.) with query params
 * - Applies app-level and page-level themes
 * - Provides QueryParamProvider for client-side variable resolution
 * - No authentication or editing capabilities
 */
export function PublicPageRenderer({ page, app, orgSlug, appSlug, pages }: PublicPageRendererProps) {
  const searchParams = useSearchParams()
  const [resolvedData, setResolvedData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)

  // Convert URLSearchParams to Record for QueryParamContext and resolveAllData
  const queryParamsObject: Record<string, string | string[]> = {}
  searchParams.forEach((value, key) => {
    const existing = queryParamsObject[key]
    if (existing) {
      if (Array.isArray(existing)) {
        existing.push(value)
      } else {
        queryParamsObject[key] = [existing, value]
      }
    } else {
      queryParamsObject[key] = value
    }
  })

  // Resolve component data (calls resolveData on components like DataBlock)
  // Pass isPublicPage flag and pageId so DataBlock can use public view execution
  useEffect(() => {
    async function resolveData() {
      setLoading(true)
      try {
        const resolved = await resolveAllData(
          page.templateData,
          config,
          {
            ...queryParamsObject,
            isPublicPage: true,
            pageId: page.id,
          }
        )
        setResolvedData(resolved)
      } catch (error) {
        console.error('[PublicPageRenderer] Error resolving data:', error)
        // Fall back to unresolved data on error
        setResolvedData(page.templateData as Data)
      } finally {
        setLoading(false)
      }
    }
    resolveData()
  }, [page.templateData, page.id, searchParams])

  // Show loading state while resolving data
  if (loading || !resolvedData) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <Loading text="Loading..." />
      </div>
    )
  }

  // Determine effective theme (page theme overrides app theme)
  const appTheme = app.themeConfig ? ThemeConfig.fromJSON(app.themeConfig) : ThemeConfig.default()
  const pageTheme = page.themeConfig ? ThemeConfig.fromJSON(page.themeConfig) : undefined
  const effectiveTheme = pageTheme ? ThemeConfig.merge(appTheme, pageTheme) : appTheme

  return (
    <PageContextProvider
      value={{
        orgSlug,
        appSlug,
        appId: app.id,
        pages,
        isEditing: false,
        isPreview: false,
        params: queryParamsObject,
        theme: effectiveTheme,
      }}
    >
      <div className="min-h-screen w-full">
        <Render
          config={config}
          data={resolvedData}
        />
      </div>
    </PageContextProvider>
  )
}
