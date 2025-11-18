"use client"

// AIDEV-NOTE: Client component for rendering public Puck pages
// Uses Puck's Render component with app/page theme configuration

import { Render } from "@measured/puck"
import "@measured/puck/puck.css"
import { config } from "@/components/puck/config"
import type { PageDTO } from "@/app/mappers/puck-page-mapper"
import type { AppDTO } from "@/app/mappers/puck-app-mapper"
import { ThemeConfig } from "@/ddd/domain/puck/value-objects/theme-config"

interface PublicPageRendererProps {
  page: PageDTO
  app: AppDTO
}

/**
 * PublicPageRenderer - Renders a published Puck page
 *
 * Features:
 * - Applies app-level and page-level themes
 * - Renders Puck template data
 * - No authentication or editing capabilities
 */
export function PublicPageRenderer({ page, app }: PublicPageRendererProps) {
  // Determine effective theme (page theme overrides app theme)
  const appTheme = app.themeConfig ? ThemeConfig.fromJSON(app.themeConfig) : ThemeConfig.default()
  const pageTheme = page.themeConfig ? ThemeConfig.fromJSON(page.themeConfig) : undefined
  const effectiveTheme = pageTheme ? ThemeConfig.merge(appTheme, pageTheme) : appTheme

  // Apply theme as CSS variables
  const themeStyles: Record<string, string | number> = {
    '--color-primary': effectiveTheme.colors.primary,
    '--color-secondary': effectiveTheme.colors.secondary,
    '--color-background': effectiveTheme.colors.background,
    '--color-surface': effectiveTheme.colors.surface,
    '--color-text': effectiveTheme.colors.text,
    '--color-text-muted': effectiveTheme.colors.textMuted,
    '--color-border': effectiveTheme.colors.border,
    '--color-link': effectiveTheme.colors.link,
    '--color-success': effectiveTheme.colors.success,
    '--color-warning': effectiveTheme.colors.warning,
    '--color-error': effectiveTheme.colors.error,
    '--font-family': effectiveTheme.typography.fontFamily,
    '--font-size': effectiveTheme.typography.fontSize,
    '--heading-font-weight': effectiveTheme.typography.headingFontWeight,
    '--spacing-unit': effectiveTheme.spacing.unit,
    '--spacing-scale': effectiveTheme.spacing.scale,
    '--border-radius': effectiveTheme.borders.radius,
    '--border-width': effectiveTheme.borders.width
  }

  // Optionally apply heading color
  if (effectiveTheme.typography.headingColor) {
    themeStyles['--heading-color'] = effectiveTheme.typography.headingColor
  }

  return (
    <div
      className="min-h-screen w-full"
      style={themeStyles}
    >
      <Render
        config={config}
        data={page.templateData}
      />
    </div>
  )
}
