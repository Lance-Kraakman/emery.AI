'use client'

import { BaseCanvas } from './BaseCanvas'
import { Building, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * OrganizationCanvas - Canvas for Organization settings page
 * 
 * Features:
 * - Organization configuration
 * - Member management
 * - Settings and preferences
 * 
 * AIDEV-NOTE: Organization page canvas for managing org settings and members.
 */

interface OrganizationCanvasProps {
  organizationName?: string
  children?: React.ReactNode
}

export function OrganizationCanvas({ organizationName, children }: OrganizationCanvasProps) {
  return (
    <BaseCanvas
      title={organizationName || 'Organization'}
      subtitle="Manage organization settings, members, and configuration"
      icon={<Building className="h-5 w-5" />}
      headerActions={
        <Button size="sm" variant="outline">
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      }
    >
      <div className="h-full flex flex-col overflow-hidden">
        {children || (
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-4xl mx-auto space-y-8">
              {/* Organization Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-lg border border-border bg-card">
                  <h3 className="font-semibold mb-4">Organization Details</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Name</label>
                      <p className="font-medium">{organizationName || 'Your Organization'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Members</label>
                      <p className="font-medium">8 active members</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Plan</label>
                      <p className="font-medium">Professional</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-lg border border-border bg-card">
                  <h3 className="font-semibold mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <Button variant="outline" className="w-full justify-start">
                      Invite Members
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      Manage Permissions
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      View Usage Analytics
                    </Button>
                  </div>
                </div>
              </div>

              {/* Settings Sections */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Configuration</h3>
                <div className="rounded-lg border border-border bg-card p-8 text-center">
                  <p className="text-muted-foreground">
                    Organization management features are coming soon.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </BaseCanvas>
  )
}