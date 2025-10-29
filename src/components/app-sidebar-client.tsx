"use client"

import { AppSidebar } from "./app-sidebar"
import { useEffect, useState } from "react"
import { getApps } from "@/app/actions/puck-apps"
import { getPages } from "@/app/actions/puck-pages"
import { getAgents } from "@/app/actions/agents"
import { getTeams } from "@/app/actions/teams"
import { getSkillsByOrganization } from "@/app/actions/skills"
import { useSession } from "next-auth/react"

// AIDEV-NOTE: Client-side wrapper that fetches sidebar data
// This is a temporary solution - ideally we'd fetch on server and pass as props

export function AppSidebarClient() {
  const { data: session } = useSession()
  const [data, setData] = useState<{
    apps: any[]
    agents: any[]
    teams: any[]
    skills: any[]
    databases: any[]
  }>({
    apps: [],
    agents: [],
    teams: [],
    skills: [],
    databases: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      if (!session?.user?.currentOrganizationId) {
        setLoading(false)
        return
      }

      try {
        const [appsResult, agentsResult, teamsResult, skillsResult] = await Promise.all([
          getApps(),
          getAgents(),
          getTeams(),
          getSkillsByOrganization(session.user.currentOrganizationId)
        ])

        // Fetch pages for each app
        const appsWithPages = await Promise.all(
          (appsResult || []).map(async (app: any) => {
            const pages = await getPages(app.id)
            return {
              ...app,
              pages: pages || []
            }
          })
        )

        setData({
          apps: appsWithPages.map((app: any) => ({
            id: app.id,
            name: app.name,
            pages: app.pages.map((page: any) => ({
              id: page.id,
              name: page.name,
              appId: app.id
            }))
          })),
          agents: (agentsResult || []).map((agent: any) => ({
            id: agent.id,
            name: agent.name
          })),
          teams: (teamsResult || []).map((team: any) => ({
            id: team.id,
            name: team.name
          })),
          skills: (skillsResult?.success && skillsResult?.data ? skillsResult.data : []).map((skill: any) => ({
            id: skill.id,
            name: skill.name
          })),
          databases: [] // TODO: Fetch databases
        })
      } catch (error) {
        console.error("Error fetching sidebar data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [session?.user?.currentOrganizationId])

  if (loading) {
    return <div>Loading...</div> // TODO: Better loading state
  }

  return <AppSidebar {...data} />
}
