'use client'

import React from 'react'
import { useSearchParams } from 'next/navigation'
import DashboardMainContent from '@/src/app/components/DashboardMainContent'
import { MissionControlPage } from '@/src/components/canvas'

/**
 * MissionControlClient - Mission Control page with canvas structure
 * 
 * Uses MissionControlPage to provide collapsible main content.
 * When canvas is collapsed, chat becomes the main view.
 * 
 * AIDEV-NOTE: Updated to use new canvas-based architecture.
 */

function PageContent(): JSX.Element {
  const searchParams = useSearchParams()
  const tableId = searchParams?.get('tableId')
  
  // If there's a tableId, show the dashboard content in canvas
  if (tableId) {
    return (
      <MissionControlPage>
        <DashboardMainContent />
      </MissionControlPage>
    )
  }
  
  // Otherwise show the default mission control page
  return <MissionControlPage />
}

export default function MissionControlClient(): JSX.Element {
  return <PageContent />
}