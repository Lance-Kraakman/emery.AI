'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { 
  Wrench, 
  Bot, 
  Users, 
  Settings, 
  Database,
  Table,
  Key,
  UserCog,
  Monitor
} from 'lucide-react'
import { PREDEFINED_TOOLS, getAvailableToolsForUser } from '@/lib/agents/tools-registry'
import { useEmery } from '@/contexts/EmeryContext'
import { getUserOAuthConnections } from '@/app/actions/connections'
import type { NormalizedConnection } from '@/lib/pipedream/connection-mapper'
import type {
  ChatMentionsHook,
  MentionDropdownState,
  AnyMentionItem,
  CategoryConfig,
  MentionCategory,
  ToolMentionItem,
  AgentMentionItem,
  TeamMentionItem,
  DataMentionItem,
  SettingsMentionItem,
  MentionHandlers
} from './types/chat-mentions'

/**
 * useChatMentions - Hook for managing chat mention state and data
 * 
 * Features:
 * - State management for dropdown UI
 * - Data integration with tools, agents, teams, data sources  
 * - Search and filtering logic
 * - Keyboard navigation handling
 * - Item selection and text insertion
 * 
 * AIDEV-NOTE: Central business logic hook for the mention system
 */

const DEFAULT_CONFIG = {
  enablePlusButton: true,
  enableAtMentions: true,
  enableSearch: true,
  maxDropdownHeight: 400,
  searchDebounceMs: 150,
  categories: ['tools', 'agents', 'teams', 'settings', 'data'] as MentionCategory[]
}

export function useChatMentions(): ChatMentionsHook {
  // Get data from contexts
  const { data: emeryData } = useEmery()
  const [connections, setConnections] = useState<NormalizedConnection[]>([])

  // Fetch OAuth connections for tool availability
  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const result = await getUserOAuthConnections()
        if (result.success) {
          setConnections(result.data || [])
        }
      } catch (error) {
        console.warn('Failed to fetch OAuth connections:', error)
        setConnections([]) // Fallback to empty connections
      }
    }
    
    fetchConnections()
  }, [])

  // Dropdown state management
  const [dropdownState, setDropdownState] = useState<MentionDropdownState>({
    isOpen: false,
    currentLevel: 'main',
    selectedCategory: undefined,
    searchTerm: '',
    cursorPosition: 0,
    triggerPosition: 0,
    filteredItems: [],
    selectedIndex: 0,
    triggerType: 'plus'
  })

  // Category configuration
  const categories: CategoryConfig[] = useMemo(() => [
    {
      id: 'tools',
      name: 'Tools',
      icon: <Wrench className="h-4 w-4" />,
      description: 'Integrate with external services and APIs',
      shortcut: 'T'
    },
    {
      id: 'agents',
      name: 'Agents',
      icon: <Bot className="h-4 w-4" />,
      description: 'Reference AI agents in your organization',
      shortcut: 'A'
    },
    {
      id: 'teams',
      name: 'Teams',
      icon: <Users className="h-4 w-4" />,
      description: 'Mention teams and collaborate',
      shortcut: 'M'
    },
    {
      id: 'data',
      name: 'Data',
      icon: <Database className="h-4 w-4" />,
      description: 'Reference databases and tables',
      shortcut: 'D'
    },
    {
      id: 'settings',
      name: 'Settings',
      icon: <Settings className="h-4 w-4" />,
      description: 'Link to configuration and settings',
      shortcut: 'S'
    }
  ], [])

  // Transform data into mention items
  const availableItems: Record<MentionCategory, AnyMentionItem[]> = useMemo(() => {
    // Tools items
    const availableTools = getAvailableToolsForUser(connections || [])
    const toolItems: ToolMentionItem[] = PREDEFINED_TOOLS.map(tool => ({
      id: `tool_${tool.name}`,
      name: tool.name,
      displayName: tool.display_name,
      description: tool.description,
      icon: <Wrench className="h-3 w-3" />,
      category: 'tools',
      insertText: `@tool:${tool.name}`,
      available: !tool.requires_auth || availableTools.some(t => t.name === tool.name),
      tool,
      requiresAuth: tool.requires_auth,
      oauthService: tool.oauth_service,
      subcategory: tool.category
    }))

    // Agent items
    const agentItems: AgentMentionItem[] = (emeryData?.agents || []).map(agent => ({
      id: `agent_${agent.id}`,
      name: agent.name.toLowerCase().replace(/\s+/g, '-'),
      displayName: agent.name,
      description: agent.description || 'AI Agent',
      icon: <Bot className="h-3 w-3" />,
      category: 'agents',
      insertText: `@agent:${agent.name.toLowerCase().replace(/\s+/g, '-')}`,
      available: true,
      agent,
      status: agent.status || 'active',
      organizationId: agent.organizationId || 0
    }))

    // Team items
    const teamItems: TeamMentionItem[] = (emeryData?.teams || []).map(team => ({
      id: `team_${team.id}`,
      name: team.name.toLowerCase().replace(/\s+/g, '-'),
      displayName: team.name,
      description: team.purpose || 'Team',
      icon: <Users className="h-3 w-3" />,
      category: 'teams',
      insertText: `@team:${team.name.toLowerCase().replace(/\s+/g, '-')}`,
      available: true,
      team,
      memberCount: team.agentIds?.length || 0,
      organizationId: team.organizationId || 0
    }))

    // Data items (databases and tables)
    const dataItems: DataMentionItem[] = []
    
    emeryData?.databases?.forEach(database => {
      // Add database
      dataItems.push({
        id: `database_${database.id}`,
        name: database.slug,
        displayName: database.name,
        description: database.metadata?.description || 'Database',
        icon: <Database className="h-3 w-3" />,
        category: 'data',
        insertText: `@database:${database.slug}`,
        available: true,
        type: 'database',
        databaseId: database.id
      })

      // Add tables
      database.tables?.forEach(table => {
        dataItems.push({
          id: `table_${table.id}`,
          name: table.dbName,
          displayName: table.name,
          description: `Table in ${database.name}`,
          icon: <Table className="h-3 w-3" />,
          category: 'data',
          insertText: `@table:${table.dbName}`,
          available: true,
          type: 'table',
          databaseId: database.id,
          tableId: table.id,
          parentName: database.name
        })
      })
    })

    // Settings items
    const settingsItems: SettingsMentionItem[] = [
      {
        id: 'settings_oauth',
        name: 'oauth-connections',
        displayName: 'OAuth Connections',
        description: 'Manage connected external services',
        icon: <Key className="h-3 w-3" />,
        category: 'settings',
        insertText: '@setting:oauth-connections',
        available: true,
        settingType: 'oauth',
        route: '/connections'
      },
      {
        id: 'settings_users',
        name: 'users-permissions',
        displayName: 'Users & Permissions',
        description: 'Manage team members and access',
        icon: <UserCog className="h-3 w-3" />,
        category: 'settings',
        insertText: '@setting:users-permissions',
        available: true,
        settingType: 'users',
        route: '/organization/settings/users'
      },
      {
        id: 'settings_system',
        name: 'system',
        displayName: 'System Settings',
        description: 'Configure system preferences',
        icon: <Monitor className="h-3 w-3" />,
        category: 'settings',
        insertText: '@setting:system',
        available: true,
        settingType: 'system',
        route: '/settings/system'
      }
    ]

    return {
      tools: toolItems,
      agents: agentItems,
      teams: teamItems,
      data: dataItems,
      settings: settingsItems
    }
  }, [emeryData, connections])

  // Actions
  const openDropdown = useCallback((triggerType: 'plus' | 'at', position: number) => {
    setDropdownState(prev => ({
      ...prev,
      isOpen: true,
      currentLevel: 'main',
      selectedCategory: undefined,
      searchTerm: '',
      cursorPosition: position,
      triggerPosition: position,
      selectedIndex: 0,
      triggerType
    }))
  }, [])

  const closeDropdown = useCallback(() => {
    setDropdownState(prev => ({
      ...prev,
      isOpen: false,
      currentLevel: 'main',
      selectedCategory: undefined,
      searchTerm: '',
      selectedIndex: 0
    }))
  }, [])

  const selectCategory = useCallback((category: MentionCategory) => {
    setDropdownState(prev => ({
      ...prev,
      currentLevel: 'submenu',
      selectedCategory: category,
      searchTerm: '',
      selectedIndex: 0
    }))
  }, [])

  const selectItem = useCallback((item: AnyMentionItem) => {
    // This will be handled by the parent component
    closeDropdown()
  }, [closeDropdown])

  const setSearchTerm = useCallback((term: string) => {
    setDropdownState(prev => ({
      ...prev,
      searchTerm: term,
      selectedIndex: 0 // Reset selection when searching
    }))
  }, [])

  const navigateItems = useCallback((direction: 'up' | 'down') => {
    setDropdownState(prev => {
      if (prev.currentLevel === 'main') {
        const maxIndex = categories.length - 1
        const newIndex = direction === 'down' 
          ? (prev.selectedIndex < maxIndex ? prev.selectedIndex + 1 : 0)
          : (prev.selectedIndex > 0 ? prev.selectedIndex - 1 : maxIndex)
        
        return { ...prev, selectedIndex: newIndex }
      } else if (prev.selectedCategory) {
        const items = availableItems[prev.selectedCategory] || []
        const filteredItems = items.filter(item =>
          item.name.toLowerCase().includes(prev.searchTerm.toLowerCase()) ||
          item.description?.toLowerCase().includes(prev.searchTerm.toLowerCase())
        )
        const maxIndex = filteredItems.length - 1
        const newIndex = direction === 'down'
          ? (prev.selectedIndex < maxIndex ? prev.selectedIndex + 1 : 0)
          : (prev.selectedIndex > 0 ? prev.selectedIndex - 1 : maxIndex)
        
        return { ...prev, selectedIndex: newIndex }
      }
      return prev
    })
  }, [categories.length, availableItems])

  const goBackToMain = useCallback(() => {
    setDropdownState(prev => ({
      ...prev,
      currentLevel: 'main',
      selectedCategory: undefined,
      searchTerm: '',
      selectedIndex: 0
    }))
  }, [])

  // Event handlers (pre-bound for performance)
  const handlers: MentionHandlers = useMemo(() => ({
    onItemSelect: selectItem,
    onCategorySelect: selectCategory,
    onSearchChange: setSearchTerm,
    onClose: closeDropdown,
    onKeyDown: (event: React.KeyboardEvent) => {
      // Handle keyboard navigation
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault()
          navigateItems('up')
          break
        case 'ArrowDown':
          event.preventDefault()
          navigateItems('down')
          break
        case 'Escape':
          event.preventDefault()
          if (dropdownState.currentLevel === 'submenu') {
            goBackToMain()
          } else {
            closeDropdown()
          }
          break
      }
    }
  }), [selectItem, selectCategory, setSearchTerm, closeDropdown, navigateItems, dropdownState.currentLevel, goBackToMain])

  return {
    // State
    dropdownState,
    availableItems,
    categories,
    
    // Actions
    openDropdown,
    closeDropdown,
    selectCategory,
    selectItem,
    setSearchTerm,
    navigateItems,
    goBackToMain,
    
    // Handlers
    handlers
  }
}

// AIDEV-NOTE: This hook encapsulates all mention system logic and data integration
// AIDEV-NOTE: Provides a clean API for UI components to interact with
// AIDEV-NOTE: Integrates with existing Emery data sources and OAuth connections