'use client'

import { useSearchParams } from 'next/navigation'
import DashboardMainContent from '../components/DashboardMainContent'

export default function MissionControlDashboardContent() {
  const searchParams = useSearchParams()
  const tableId = searchParams.get('tableId')

  // Always show the dashboard content which handles table selection internally
  return <DashboardMainContent />
}