'use client'

import { useSearchParams } from 'next/navigation'
import DashboardMainContent from '@/app/components/DashboardMainContent'
import { MissionControlCanvas } from '@/components/canvas'

/**
 * MissionControlClient - Mission Control page with canvas structure
 * 
 * Uses MissionControlCanvas to provide collapsible main content.
 * When canvas is collapsed, chat becomes the main view.
 * 
 * AIDEV-NOTE: Updated to use new canvas-based architecture.
 */

function PageContent(): JSX.Element {
  const searchParams = useSearchParams()
  const tableId = searchParams.get('tableId')
  
  // If there's a tableId, show the dashboard content in canvas
  if (tableId) {
    return (
      <MissionControlCanvas>
        <DashboardMainContent />
      </MissionControlCanvas>
    )
  }
  
  // Otherwise show the default mission control canvas
  return <MissionControlCanvas />
}

export default function MissionControlClient(): JSX.Element {
  return <PageContent />
}