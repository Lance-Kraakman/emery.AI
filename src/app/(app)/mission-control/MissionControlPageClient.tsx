'use client'

import React from 'react'
import { CanvasBase } from '../../../components/canvas/CanvasBase'
import { BarChart, Database, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * MissionControlPage - Wrapper for Mission Control dashboard
 *
 * Uses CanvasBase for minimal wrapper with collapse functionality.
 * Pages manage their own headers and styling.
 *
 * AIDEV-NOTE: Mission Control page wrapper showing dashboard overview.
 */

interface MissionControlPageProps {
  children?: React.ReactNode
}

export function MissionControlPage({ children }: MissionControlPageProps) {
  return (
    <CanvasBase>
      {children || (
        <div className="h-full flex flex-col overflow-auto">
          <div className="flex-1 p-6">
            <div className="max-w-6xl mx-auto space-y-8">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <Database className="h-8 w-8 text-primary" />
                    <div>
                      <h3 className="font-semibold">Data Tables</h3>
                      <p className="text-2xl font-bold text-primary">12</p>
                      <p className="text-sm text-muted-foreground">Active tables</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <Users className="h-8 w-8 text-primary" />
                    <div>
                      <h3 className="font-semibold">Team Members</h3>
                      <p className="text-2xl font-bold text-primary">8</p>
                      <p className="text-sm text-muted-foreground">Active users</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <BarChart className="h-8 w-8 text-primary" />
                    <div>
                      <h3 className="font-semibold">Workflows</h3>
                      <p className="text-2xl font-bold text-primary">5</p>
                      <p className="text-sm text-muted-foreground">Running</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Dashboard Content */}
              <div className="rounded-lg border border-border bg-card p-8">
                <div className="text-center space-y-4">
                  <h2 className="text-2xl font-bold">Dashboard Coming Soon</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    The full mission control dashboard with analytics, monitoring, and management tools will be available soon.
                  </p>
                  <div className="flex justify-center gap-4 mt-6">
                    <Button variant="outline">View Analytics</Button>
                    <Button>Manage System</Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </CanvasBase>
  )
}