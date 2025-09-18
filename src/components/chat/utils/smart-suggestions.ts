/**
 * Smart Suggestions Engine for Chat Mentions
 * 
 * ML-powered suggestion system that learns from user patterns and context
 * to provide intelligent mention recommendations.
 * 
 * Features:
 * - Context-aware suggestions based on message content
 * - User behavior learning and pattern recognition
 * - Relevance scoring and ranking
 * - Real-time adaptive suggestions
 * 
 * AIDEV-NOTE: ML-powered suggestion engine for enhanced mention discovery
 */

import type { AnyMentionItem, MentionCategory } from '../types/chat-mentions'

// Suggestion scoring weights
interface SuggestionWeights {
  recency: number        // How recently was this item used
  frequency: number      // How often is this item used
  contextRelevance: number // How relevant to current conversation context
  userPreference: number   // User's historical preference patterns
  categoryRelevance: number // Category-specific context boost
}

const DEFAULT_WEIGHTS: SuggestionWeights = {
  recency: 0.25,
  frequency: 0.20,
  contextRelevance: 0.30,
  userPreference: 0.15,
  categoryRelevance: 0.10
}

// User behavior tracking
interface UserBehaviorData {
  itemUsage: Map<string, { count: number; lastUsed: Date; contexts: string[] }>
  categoryPreferences: Map<MentionCategory, number>
  contextPatterns: Map<string, string[]> // keyword -> commonly used items
  sessionStartTime: Date
}

// Context analysis patterns
const CONTEXT_KEYWORDS: Record<string, { category: MentionCategory; boost: number }[]> = {
  // Task and workflow keywords
  'schedule': [{ category: 'agents', boost: 1.2 }, { category: 'tools', boost: 1.1 }],
  'automate': [{ category: 'agents', boost: 1.3 }, { category: 'tools', boost: 1.2 }],
  'integrate': [{ category: 'tools', boost: 1.4 }, { category: 'settings', boost: 1.1 }],
  
  // Data and analysis keywords  
  'analyze': [{ category: 'data', boost: 1.3 }, { category: 'agents', boost: 1.2 }],
  'database': [{ category: 'data', boost: 1.4 }, { category: 'tools', boost: 1.1 }],
  'table': [{ category: 'data', boost: 1.4 }],
  'query': [{ category: 'data', boost: 1.2 }, { category: 'tools', boost: 1.1 }],
  
  // Communication keywords
  'notify': [{ category: 'tools', boost: 1.3 }, { category: 'teams', boost: 1.2 }],
  'message': [{ category: 'tools', boost: 1.2 }, { category: 'teams', boost: 1.3 }],
  'collaborate': [{ category: 'teams', boost: 1.4 }, { category: 'tools', boost: 1.1 }],
  
  // Configuration keywords
  'configure': [{ category: 'settings', boost: 1.4 }, { category: 'tools', boost: 1.1 }],
  'setup': [{ category: 'settings', boost: 1.3 }, { category: 'tools', boost: 1.2 }],
  'connect': [{ category: 'tools', boost: 1.3 }, { category: 'settings', boost: 1.2 }],
  
  // Agent-specific keywords
  'bot': [{ category: 'agents', boost: 1.4 }],
  'assistant': [{ category: 'agents', boost: 1.3 }],
  'ai': [{ category: 'agents', boost: 1.2 }, { category: 'tools', boost: 1.1 }]
}

/**
 * Smart suggestions engine with ML-powered recommendations
 */
export class SmartSuggestionsEngine {
  private userBehavior: UserBehaviorData
  private weights: SuggestionWeights

  constructor(weights: Partial<SuggestionWeights> = {}) {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights }
    this.userBehavior = {
      itemUsage: new Map(),
      categoryPreferences: new Map(),
      contextPatterns: new Map(),
      sessionStartTime: new Date()
    }
    
    // Load persisted behavior data
    this.loadUserBehavior()
  }

  /**
   * Generate smart suggestions based on context and user behavior
   */
  generateSuggestions(
    allItems: Record<MentionCategory, AnyMentionItem[]>,
    context: {
      currentMessage?: string
      recentMessages?: string[]
      currentCategory?: MentionCategory
      partialInput?: string
    },
    maxSuggestions: number = 5
  ): AnyMentionItem[] {
    const flatItems = Object.values(allItems).flat()
    const scoredItems = flatItems.map(item => ({
      item,
      score: this.calculateSuggestionScore(item, context)
    }))

    // Sort by score and return top suggestions
    return scoredItems
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSuggestions)
      .map(scored => scored.item)
  }

  /**
   * Calculate suggestion score for an item based on multiple factors
   */
  private calculateSuggestionScore(
    item: AnyMentionItem, 
    context: {
      currentMessage?: string
      recentMessages?: string[]
      currentCategory?: MentionCategory
      partialInput?: string
    }
  ): number {
    let score = 0
    
    // Recency score - how recently was this used
    const usage = this.userBehavior.itemUsage.get(item.id)
    if (usage) {
      const daysSinceUsed = (Date.now() - usage.lastUsed.getTime()) / (1000 * 60 * 60 * 24)
      score += this.weights.recency * Math.exp(-daysSinceUsed / 7) // Decay over a week
    }
    
    // Frequency score - how often is this used
    if (usage) {
      const sessionDays = (Date.now() - this.userBehavior.sessionStartTime.getTime()) / (1000 * 60 * 60 * 24)
      const normalizedFrequency = Math.min(usage.count / Math.max(sessionDays, 1), 3) // Cap at 3 uses per day
      score += this.weights.frequency * (normalizedFrequency / 3)
    }
    
    // Context relevance - how relevant to current conversation
    score += this.weights.contextRelevance * this.calculateContextRelevance(item, context)
    
    // User preference - category preferences
    const categoryPreference = this.userBehavior.categoryPreferences.get(item.category) || 0
    score += this.weights.userPreference * (categoryPreference / 10) // Normalize to 0-1
    
    // Category relevance - boost based on context keywords
    score += this.weights.categoryRelevance * this.calculateCategoryRelevance(item, context)
    
    // Availability boost - prefer available items
    if (item.available !== false) {
      score *= 1.2
    }
    
    return score
  }

  /**
   * Calculate how relevant an item is to the current context
   */
  private calculateContextRelevance(
    item: AnyMentionItem,
    context: {
      currentMessage?: string
      recentMessages?: string[]
      currentCategory?: MentionCategory
      partialInput?: string
    }
  ): number {
    let relevance = 0
    
    // Check current message context
    if (context.currentMessage) {
      relevance += this.calculateTextRelevance(item, context.currentMessage)
    }
    
    // Check recent message context (with decay)
    if (context.recentMessages) {
      context.recentMessages.forEach((message, index) => {
        const decay = Math.pow(0.8, index) // Earlier messages have less weight
        relevance += decay * this.calculateTextRelevance(item, message)
      })
    }
    
    // Boost if matching current category
    if (context.currentCategory && context.currentCategory === item.category) {
      relevance += 0.3
    }
    
    // Partial input matching
    if (context.partialInput) {
      if (item.name.toLowerCase().includes(context.partialInput.toLowerCase())) {
        relevance += 0.4
      }
      if (item.displayName.toLowerCase().includes(context.partialInput.toLowerCase())) {
        relevance += 0.3
      }
    }
    
    return Math.min(relevance, 1.0) // Cap at 1.0
  }

  /**
   * Calculate text relevance using keyword matching and semantic analysis
   */
  private calculateTextRelevance(item: AnyMentionItem, text: string): number {
    const lowerText = text.toLowerCase()
    let relevance = 0
    
    // Direct name mentions
    if (lowerText.includes(item.name.toLowerCase())) {
      relevance += 0.5
    }
    
    if (lowerText.includes(item.displayName.toLowerCase())) {
      relevance += 0.4
    }
    
    // Description keyword matching
    if (item.description) {
      const descWords = item.description.toLowerCase().split(/\s+/)
      const textWords = lowerText.split(/\s+/)
      const commonWords = descWords.filter(word => 
        word.length > 3 && textWords.some(tw => tw.includes(word) || word.includes(tw))
      )
      relevance += Math.min(commonWords.length * 0.1, 0.3)
    }
    
    // Category-specific keyword matching
    const categoryKeywords = this.getCategoryKeywords(item.category)
    categoryKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) {
        relevance += 0.15
      }
    })
    
    return Math.min(relevance, 1.0)
  }

  /**
   * Calculate category relevance boost based on context keywords
   */
  private calculateCategoryRelevance(
    item: AnyMentionItem,
    context: { currentMessage?: string; recentMessages?: string[] }
  ): number {
    let relevance = 0
    const allText = [context.currentMessage, ...(context.recentMessages || [])].join(' ').toLowerCase()
    
    Object.entries(CONTEXT_KEYWORDS).forEach(([keyword, boosts]) => {
      if (allText.includes(keyword)) {
        const categoryBoost = boosts.find(b => b.category === item.category)
        if (categoryBoost) {
          relevance += (categoryBoost.boost - 1) // Convert 1.2 boost to 0.2 relevance
        }
      }
    })
    
    return Math.min(relevance, 1.0)
  }

  /**
   * Get keywords associated with a category
   */
  private getCategoryKeywords(category: MentionCategory): string[] {
    const keywordMap: Record<MentionCategory, string[]> = {
      tools: ['tool', 'api', 'service', 'integration', 'connect', 'automate', 'webhook'],
      agents: ['agent', 'bot', 'ai', 'assistant', 'automate', 'schedule', 'task'],
      teams: ['team', 'group', 'collaborate', 'member', 'assign', 'notify'],
      data: ['data', 'database', 'table', 'query', 'analyze', 'report', 'chart'],
      settings: ['setting', 'config', 'configure', 'setup', 'permission', 'access'],
      documents: ['document', 'tiptap', 'editor', 'write', 'text', 'draft']
    }
    
    return keywordMap[category] || []
  }

  /**
   * Track item usage for learning
   */
  trackUsage(item: AnyMentionItem, context: string = '') {
    const usage = this.userBehavior.itemUsage.get(item.id) || {
      count: 0,
      lastUsed: new Date(),
      contexts: []
    }
    
    usage.count++
    usage.lastUsed = new Date()
    
    // Track context for pattern learning
    if (context.trim()) {
      usage.contexts.push(context.toLowerCase())
      // Keep only recent contexts (last 10)
      if (usage.contexts.length > 10) {
        usage.contexts = usage.contexts.slice(-10)
      }
    }
    
    this.userBehavior.itemUsage.set(item.id, usage)
    
    // Update category preferences
    const currentPref = this.userBehavior.categoryPreferences.get(item.category) || 0
    this.userBehavior.categoryPreferences.set(item.category, currentPref + 1)
    
    // Persist behavior data
    this.saveUserBehavior()
  }

  /**
   * Get trending suggestions based on recent usage patterns
   */
  getTrendingSuggestions(
    allItems: Record<MentionCategory, AnyMentionItem[]>,
    maxSuggestions: number = 3
  ): AnyMentionItem[] {
    const flatItems = Object.values(allItems).flat()
    const now = Date.now()
    const dayInMs = 24 * 60 * 60 * 1000
    
    // Get items used in the last 3 days, sorted by usage frequency
    const trendingItems = flatItems
      .map(item => {
        const usage = this.userBehavior.itemUsage.get(item.id)
        if (!usage || now - usage.lastUsed.getTime() > 3 * dayInMs) {
          return { item, score: 0 }
        }
        
        const recencyBoost = Math.exp(-(now - usage.lastUsed.getTime()) / dayInMs)
        return { item, score: usage.count * recencyBoost }
      })
      .filter(scored => scored.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSuggestions)
    
    return trendingItems.map(scored => scored.item)
  }

  /**
   * Load user behavior from localStorage
   */
  private loadUserBehavior() {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('emery-chat-behavior')
        if (saved) {
          const data = JSON.parse(saved)
          
          // Restore maps from serialized data
          this.userBehavior.itemUsage = new Map(
            data.itemUsage.map(([id, usage]: [string, any]) => [
              id, 
              { ...usage, lastUsed: new Date(usage.lastUsed) }
            ])
          )
          this.userBehavior.categoryPreferences = new Map(data.categoryPreferences)
          this.userBehavior.contextPatterns = new Map(data.contextPatterns)
          this.userBehavior.sessionStartTime = new Date(data.sessionStartTime || Date.now())
        }
      }
    } catch (error) {
      console.warn('Failed to load user behavior data:', error)
    }
  }

  /**
   * Save user behavior to localStorage
   */
  private saveUserBehavior() {
    try {
      if (typeof window !== 'undefined') {
        const data = {
          itemUsage: Array.from(this.userBehavior.itemUsage.entries()),
          categoryPreferences: Array.from(this.userBehavior.categoryPreferences.entries()),
          contextPatterns: Array.from(this.userBehavior.contextPatterns.entries()),
          sessionStartTime: this.userBehavior.sessionStartTime.toISOString()
        }
        localStorage.setItem('emery-chat-behavior', JSON.stringify(data))
      }
    } catch (error) {
      console.warn('Failed to save user behavior data:', error)
    }
  }

  /**
   * Clear all behavior data (for testing or reset)
   */
  clearBehaviorData() {
    this.userBehavior = {
      itemUsage: new Map(),
      categoryPreferences: new Map(),
      contextPatterns: new Map(),
      sessionStartTime: new Date()
    }
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('emery-chat-behavior')
    }
  }
}

/**
 * Get contextual suggestions for current input
 */
export function getContextualSuggestions(
  currentMessage: string,
  allItems: Record<MentionCategory, AnyMentionItem[]>,
  maxSuggestions: number = 5
): AnyMentionItem[] {
  const engine = new SmartSuggestionsEngine()
  
  return engine.generateSuggestions(
    allItems,
    { currentMessage },
    maxSuggestions
  )
}

/**
 * Get quick suggestions for empty input (most commonly used)
 */
export function getQuickSuggestions(
  allItems: Record<MentionCategory, AnyMentionItem[]>,
  maxSuggestions: number = 3
): AnyMentionItem[] {
  const engine = new SmartSuggestionsEngine()
  
  return engine.getTrendingSuggestions(allItems, maxSuggestions)
}

// Export the engine for direct use
export const smartSuggestionsEngine = new SmartSuggestionsEngine()

// AIDEV-NOTE: This provides ML-powered suggestion capabilities with user behavior learning
// AIDEV-NOTE: Features context analysis, usage tracking, and intelligent ranking algorithms  
// AIDEV-NOTE: Persists user preferences in localStorage for personalized experience