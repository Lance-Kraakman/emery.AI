import React from 'react'
import { Toaster } from 'sonner'
import AnimatedBackground from '@/app/components/AnimatedBackground'
import { EmeryProviders } from '@/components/EmeryProviders'
import { auth } from '@/lib/auth'
import { getAgents } from '@/app/actions/agents'
// import { getTeams } from '@/app/actions/teams' // Teams coming soon
import { getSkillsByOrganization } from '@/app/actions/skills'
import { getDatabases } from '@/app/actions/databases'
import { getTables } from '@/app/actions/tables'
import { getAppApplicationService } from '@/ddd/application/di/container'
import { OrganizationId } from '@/ddd/domain/shared/value-objects'

// AIDEV-NOTE: Server-side sidebar data fetching moved to layout
// Uses optimized 2-query approach for apps+pages instead of N+1

interface SidebarApp {
  id: number
  name: string
  slug: string
  pages: { id: number; name: string; slug: string; appId: number }[]
}

interface SidebarItem {
  id: number
  name: string
}

interface SidebarSkill {
  id: number
  name: string
  agentId: number | null
  agentName?: string
}

interface SidebarDatabase {
  id: number
  name: string
  tables: { id: number; name: string }[]
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  let sidebarData: {
    apps: SidebarApp[]
    agents: SidebarItem[]
    teams: SidebarItem[]
    skills: SidebarSkill[]
    databases: SidebarDatabase[]
  } = {
    apps: [],
    agents: [],
    teams: [],
    skills: [],
    databases: []
  }

  // Only fetch if user has an organization
  if (session?.user?.currentOrganizationId) {
    try {
      const startTime = Date.now()
      const orgId = OrganizationId.fromNumber(session.user.currentOrganizationId)

      // Fetch all sidebar data in parallel (no N+1 - apps+pages use optimized 2-query approach)
      // Teams fetch skipped - feature coming soon
      const [appsWithPages, agentsResult, skillsResult, databasesResult, tablesResult] = await Promise.all([
        getAppApplicationService().getAppsWithPagesForOrganization(orgId),
        getAgents(),
        getSkillsByOrganization(session.user.currentOrganizationId),
        getDatabases(),
        getTables()
      ])

      console.log(`[PERF] Sidebar data fetch: ${Date.now() - startTime}ms`)

      // Group tables by database
      const tablesByDatabase = (tablesResult || []).reduce((acc, table) => {
        if (!acc[table.databaseId]) {
          acc[table.databaseId] = []
        }
        acc[table.databaseId].push(table)
        return acc
      }, {} as Record<number, typeof tablesResult>)

      sidebarData = {
        apps: appsWithPages.map(app => ({
          id: app.id,
          name: app.name,
          slug: app.slug,
          pages: app.pages.map(page => ({
            id: page.id,
            name: page.name,
            slug: page.slug,
            appId: app.id
          }))
        })),
        agents: (agentsResult || []).map(agent => ({
          id: agent.id,
          name: agent.name
        })),
        teams: [], // Teams coming soon
        skills: (skillsResult?.success && skillsResult?.data ? skillsResult.data : []).map(skill => {
          // Find agent name if this is an agent-specific skill
          const agent = skill.agentId ? (agentsResult || []).find(a => a.id === skill.agentId) : null
          return {
            id: skill.id,
            name: skill.name,
            agentId: skill.agentId,
            agentName: agent?.name,
          }
        }),
        databases: (databasesResult || []).map(database => ({
          id: database.id,
          name: database.name,
          tables: (tablesByDatabase[database.id] || []).map(table => ({
            id: table.id,
            name: table.name
          }))
        }))
      }
    } catch (error) {
      console.error("Error fetching sidebar data:", error)
    }
  }

  return (
    <React.Fragment key="app-layout">
      <AnimatedBackground />
      <EmeryProviders sidebarData={sidebarData}>
        <div className="relative z-10 h-full">
          {children}
        </div>
        <Toaster position="bottom-right" />
      </EmeryProviders>
    </React.Fragment>
  )
}