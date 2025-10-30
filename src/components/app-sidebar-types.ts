export interface AppData {
  id: number
  name: string
  slug: string
  pages?: PageData[]
}

export interface PageData {
  id: number
  name: string
  slug: string
  appId: number
}

export interface AgentData {
  id: number
  name: string
}

export interface TeamData {
  id: number
  name: string
}

export interface SkillData {
  id: number
  name: string
}

export interface DatabaseData {
  id: number
  name: string
  tables: TableData[]
}

export interface TableData {
  id: number
  name: string
}

export interface AppSidebarProps {
  apps: AppData[]
  agents: AgentData[]
  teams: TeamData[]
  skills: SkillData[]
  databases: DatabaseData[]
}
