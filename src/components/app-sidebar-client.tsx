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

interface SidebarPage {
  id: number
  name: string
  appId: number
}

interface SidebarApp {
  id: number
  name: string
  pages: SidebarPage[]
}

interface SidebarAgent {
  id: number
  name: string
}

interface SidebarTeam {
  id: number
  name: string
}

interface SidebarSkill {
  id: number
  name: string
}

interface SidebarTable {
  id: number
  name: string
}

interface SidebarDatabase {
  id: number
  name: string
  tables: SidebarTable[]
}

interface SidebarData {
  apps: SidebarApp[]
  agents: SidebarAgent[]
  teams: SidebarTeam[]
  skills: SidebarSkill[]
  databases: SidebarDatabase[]
}

export function AppSidebarClient() {
  const { data: session } = useSession()
  const [data, setData] = useState<SidebarData>({
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
          (appsResult || []).map(async (app) => {
            const pages = await getPages(app.id)
            return {
              ...app,
              pages: pages || []
            }
          })
        )

        setData({
          apps: appsWithPages.map((app) => ({
            id: app.id,
            name: app.name,
            pages: app.pages.map((page) => ({
              id: page.id,
              name: page.name,
              appId: app.id
            }))
          })),
          agents: (agentsResult || []).map((agent) => ({
            id: agent.id,
            name: agent.name
          })),
          teams: (teamsResult || []).map((team) => ({
            id: team.id,
            name: team.name
          })),
          skills: (skillsResult?.success && skillsResult?.data ? skillsResult.data : []).map((skill) => ({
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
