import { getApps } from "@/app/actions/puck-apps"
import { getPages } from "@/app/actions/puck-pages"
import { getAgents } from "@/app/actions/agents"
import { getTeams } from "@/app/actions/teams"
import { getSkillsByOrganization } from "@/app/actions/skills"
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
  const [appsResult, agentsResult, teamsResult, skillsResult] = await Promise.all([
    getApps(),
    getAgents(),
    getTeams(),
    getSkillsByOrganization(session.user.currentOrganizationId)
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

  // Transform data to match AppSidebar interface
  const apps = appsWithPages.map(app => ({
    id: app.id,
    name: app.name,
    pages: app.pages.map(page => ({
      id: page.id,
      name: page.name,
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

  // TODO: Fetch databases
  const databases: any[] = []

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
