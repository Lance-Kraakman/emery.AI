import { getApps } from "@/app/actions/puck-apps"
import { getPages } from "@/app/actions/puck-pages"
import { getAgents } from "@/app/actions/agents"
import { getTeams } from "@/app/actions/teams"
import { getSkillsByOrganization } from "@/app/actions/skills"
import { getDatabases } from "@/app/actions/databases"
import { getTables } from "@/app/actions/tables"
import { AppSidebar } from "./app-sidebar"
import { auth } from "@/lib/auth"

// AIDEV-NOTE: Server component that fetches sidebar data
// This wraps the client AppSidebar component with server-fetched data

export async function AppSidebarWrapper() {
  const session = await auth()

  if (!session?.user?.currentOrganizationId) {
    return <AppSidebar apps={[]} agents={[]} teams={[]} skills={[]} databases={[]} />
  }

  // Fetch all data in parallel
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

  // Transform data to match AppSidebar interface
  const apps = appsWithPages.map(app => ({
    id: app.id,
    name: app.name,
    slug: app.slug,
    pages: app.pages.map(page => ({
      id: page.id,
      name: page.name,
      slug: page.slug,
      appId: app.id
    }))
  }))

  const agents = (agentsResult || []).map(agent => ({
    id: agent.id,
    name: agent.name
  }))

  const teams = (teamsResult || []).map(team => ({
    id: team.id,
    name: team.name
  }))

  const skills = (skillsResult?.success && skillsResult?.data ? skillsResult.data : []).map(skill => ({
    id: skill.id,
    name: skill.name
  }))

  const databases = (databasesResult || []).map(database => ({
    id: database.id,
    name: database.name,
    tables: (tablesByDatabase[database.id] || []).map(table => ({
      id: table.id,
      name: table.name
    }))
  }))

  return (
    <AppSidebar
      apps={apps}
      agents={agents}
      teams={teams}
      skills={skills}
      databases={databases}
    />
  )
}
