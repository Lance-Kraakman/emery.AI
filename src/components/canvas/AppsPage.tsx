'use client'

import React from 'react'
import { BasePage } from './BasePage'
import { AppWindow, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * AppsPage - Page wrapper for Puck Apps management
 *
 * Features:
 * - Visual page builder app listing
 * - App creation and configuration
 * - Page management within apps
 *
 * AIDEV-NOTE: Canvas wrapper for Puck CMS apps management page
 */

interface AppsPageProps {
  appId?: number
  children?: React.ReactNode
}

export function AppsPage({ appId, children }: AppsPageProps) {
  const title = appId ? `App Configuration` : 'Apps'
  const subtitle = appId ? `Configure app ${appId}` : 'Manage your visual page builder apps'

  return (
    <BasePage
      title={title}
      subtitle={subtitle}
      icon={<AppWindow className="h-5 w-5" />}
    >
      <div className="h-full flex flex-col overflow-hidden">
        {children || (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <AppWindow className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No apps configured</h3>
              <p className="text-muted-foreground mb-4">
                Create your first app to start building pages with the visual editor.
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create App
              </Button>
            </div>
          </div>
        )}
      </div>
    </BasePage>
  )
}
