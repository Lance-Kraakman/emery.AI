import React from 'react'
import { Toaster } from 'sonner'
import AnimatedBackground from '@/app/components/AnimatedBackground'
import { EmeryProviders } from '@/components/EmeryProviders'
import { auth } from '@/lib/auth'
import { getApps } from '@/app/actions/puck-apps'
import { getPages } from '@/app/actions/puck-pages'
import { getAgents } from '@/app/actions/agents'
import { getTeams } from '@/app/actions/teams'
import { getSkillsByOrganization } from '@/app/actions/skills'
import { getDatabases } from '@/app/actions/databases'
import { getTables } from '@/app/actions/tables'

// AIDEV-NOTE: Server-side sidebar data fetching moved to layout
// Eliminates client-side waterfalls and loading states

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
      const [appsResult, agentsResult, teamsResult, skillsResult, databasesResult, tablesResult] = await Promise.all([
        getApps(),
        getAgents(),
        getTeams(),
        getSkillsByOrganization(session.user.currentOrganizationId),
        getDatabases(),
        getTables()
      ])

      // Fetch pages for each app
      const appsWithPages = await Promise.all(
        (appsResult || []).map(async (app) => {
          const pages = await getPages(app.id)
          return {
            ...app,
            pages: pages || []
          }
        })
      )

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
        teams: (teamsResult || []).map(team => ({
          id: team.id,
          name: team.name
        })),
        skills: (skillsResult?.success && skillsResult?.data ? skillsResult.data : []).map(skill => {
          // Find agent name if this is an agent-specific skill
          const agent = skill.agentId ? (agentsResult || []).find(a => a.id === skill.agentId) : null
          return {
            id: skill.id,
            name: skill.name,
            agentId: skill.agentId,
            agentName: agent?.name
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
    <>
      <AnimatedBackground />
      <EmeryProviders sidebarData={sidebarData}>
        <div className="relative z-10 h-full">
          {children}
        </div>
        <Toaster position="bottom-right" />
      </EmeryProviders>
    </>
  )
}