/**
 * Fuzzy Search Utilities for Chat Mentions
 * 
 * Advanced search functionality with:
 * - Fuzzy matching with scoring
 * - Acronym detection (e.g., "gs" matches "Google Sheets")
 * - Context-aware search across multiple fields
 * - Search result ranking and highlighting
 * 
 * AIDEV-NOTE: Enhanced search for better mention discovery UX
 */

import type { AnyMentionItem, MentionCategory } from '../types/chat-mentions'

// Search configuration
interface SearchConfig {
  threshold: number // Minimum score to include in results (0-1)
  caseSensitive: boolean
  includeScore: boolean
  keys: string[] // Fields to search in
  acronymBoost: number // Score boost for acronym matches
  exactMatchBoost: number // Score boost for exact matches
}

// Search result with highlighting
export interface SearchResult {
  item: AnyMentionItem
  score: number
  matches: MatchInfo[]
}

export interface MatchInfo {
  field: string
  value: string
  highlighted: string
  indices: number[][] // Character ranges that match
}

const DEFAULT_CONFIG: SearchConfig = {
  threshold: 0.1,
  caseSensitive: false,
  includeScore: true,
  keys: ['name', 'displayName', 'description'],
  acronymBoost: 0.3,
  exactMatchBoost: 0.5
}

/**
 * Fuzzy search engine for mention items
 */
export class FuzzySearchEngine {
  private config: SearchConfig

  constructor(config: Partial<SearchConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Search items with fuzzy matching and scoring
   */
  search(items: AnyMentionItem[], query: string): SearchResult[] {
    if (!query.trim()) return items.map(item => ({ item, score: 1, matches: [] }))

    const normalizedQuery = this.config.caseSensitive ? query : query.toLowerCase()
    const results: SearchResult[] = []

    for (const item of items) {
      const searchResult = this.searchItem(item, normalizedQuery)
      if (searchResult.score >= this.config.threshold) {
        results.push(searchResult)
      }
    }

    // Sort by score (highest first)
    return results.sort((a, b) => b.score - a.score)
  }

  /**
   * Search a single item across all configured fields
   */
  private searchItem(item: AnyMentionItem, query: string): SearchResult {
    const matches: MatchInfo[] = []
    let totalScore = 0
    let maxScore = 0

    for (const key of this.config.keys) {
      const value = this.getNestedValue(item, key)
      if (typeof value === 'string' && value.length > 0) {
        const match = this.fuzzyMatch(value, query)
        if (match.score > 0) {
          matches.push({
            field: key,
            value,
            highlighted: this.highlightMatches(value, match.indices),
            indices: match.indices
          })
          totalScore += match.score
          maxScore = Math.max(maxScore, match.score)
        }
      }
    }

    // Calculate final score (average with bias toward best match)
    const finalScore = matches.length > 0 
      ? (totalScore / this.config.keys.length) * 0.7 + maxScore * 0.3
      : 0

    return { item, score: finalScore, matches }
  }

  /**
   * Fuzzy match algorithm with scoring
   */
  private fuzzyMatch(text: string, pattern: string): { score: number; indices: number[][] } {
    const normalizedText = this.config.caseSensitive ? text : text.toLowerCase()
    const normalizedPattern = this.config.caseSensitive ? pattern : pattern.toLowerCase()

    // Exact match gets highest score
    if (normalizedText.includes(normalizedPattern)) {
      const startIndex = normalizedText.indexOf(normalizedPattern)
      return {
        score: 1.0 + this.config.exactMatchBoost,
        indices: [[startIndex, startIndex + normalizedPattern.length - 1]]
      }
    }

    // Acronym match (e.g., "gs" matches "Google Sheets")
    const acronymMatch = this.checkAcronymMatch(normalizedText, normalizedPattern)
    if (acronymMatch.isMatch) {
      return {
        score: 0.8 + this.config.acronymBoost,
        indices: acronymMatch.indices
      }
    }

    // Fuzzy character matching
    return this.fuzzyCharacterMatch(normalizedText, normalizedPattern)
  }

  /**
   * Check for acronym matches
   */
  private checkAcronymMatch(text: string, pattern: string): { isMatch: boolean; indices: number[][] } {
    const words = text.split(/\s+|-|_/)
    if (words.length < pattern.length) {
      return { isMatch: false, indices: [] }
    }

    const indices: number[][] = []
    let textIndex = 0
    
    for (let i = 0; i < pattern.length; i++) {
      const char = pattern[i]
      let found = false
      
      for (let j = i; j < words.length; j++) {
        if (words[j][0]?.toLowerCase() === char) {
          // Find the actual position in the original text
          const wordStart = text.indexOf(words[j], textIndex)
          if (wordStart !== -1) {
            indices.push([wordStart, wordStart])
            textIndex = wordStart + 1
            found = true
            break
          }
        }
      }
      
      if (!found) {
        return { isMatch: false, indices: [] }
      }
    }

    return { isMatch: true, indices }
  }

  /**
   * Character-by-character fuzzy matching
   */
  private fuzzyCharacterMatch(text: string, pattern: string): { score: number; indices: number[][] } {
    let patternIdx = 0
    const indices: number[][] = []
    const matches: number[] = []

    for (let i = 0; i < text.length && patternIdx < pattern.length; i++) {
      if (text[i] === pattern[patternIdx]) {
        matches.push(i)
        patternIdx++
      }
    }

    if (patternIdx !== pattern.length) {
      return { score: 0, indices: [] }
    }

    // Convert matches to ranges
    let start = matches[0]
    for (let i = 1; i < matches.length; i++) {
      if (matches[i] !== matches[i - 1] + 1) {
        indices.push([start, matches[i - 1]])
        start = matches[i]
      }
    }
    if (matches.length > 0) {
      indices.push([start, matches[matches.length - 1]])
    }

    // Score based on match density and position
    const matchRatio = pattern.length / text.length
    const startBoost = matches[0] === 0 ? 0.2 : 0 // Boost for matching at start
    const densityScore = matchRatio * 0.8 + startBoost

    return { score: Math.min(densityScore, 0.95), indices }
  }

  /**
   * Highlight matched text with HTML tags
   */
  private highlightMatches(text: string, indices: number[][]): string {
    if (indices.length === 0) return text

    let result = ''
    let lastIndex = 0

    for (const [start, end] of indices) {
      result += text.slice(lastIndex, start)
      result += `<mark class="bg-yellow-200 dark:bg-yellow-800">${text.slice(start, end + 1)}</mark>`
      lastIndex = end + 1
    }

    result += text.slice(lastIndex)
    return result
  }

  /**
   * Get nested object value by dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }
}

/**
 * Category-aware search that prioritizes matches within categories
 */
export function searchAcrossCategories(
  itemsByCategory: Record<MentionCategory, AnyMentionItem[]>,
  query: string,
  targetCategories?: MentionCategory[]
): Record<MentionCategory, SearchResult[]> {
  const engine = new FuzzySearchEngine()
  const results: Record<MentionCategory, SearchResult[]> = {} as any

  const categoriesToSearch = targetCategories || Object.keys(itemsByCategory) as MentionCategory[]

  for (const category of categoriesToSearch) {
    const items = itemsByCategory[category] || []
    const searchResults = engine.search(items, query)
    
    // Apply category-specific boosts
    const boostedResults = searchResults.map(result => ({
      ...result,
      score: result.score * getCategoryBoost(category, query)
    }))

    results[category] = boostedResults
  }

  return results
}

/**
 * Get search boost based on category and query context
 */
function getCategoryBoost(category: MentionCategory, query: string): number {
  const categoryKeywords: Record<MentionCategory, string[]> = {
    tools: ['tool', 'api', 'service', 'integration'],
    agents: ['agent', 'bot', 'ai', 'assistant'],
    teams: ['team', 'group', 'member', 'collab'],
    data: ['data', 'table', 'database', 'db'],
    settings: ['setting', 'config', 'preference', 'option']
  }

  const keywords = categoryKeywords[category] || []
  const queryLower = query.toLowerCase()
  
  for (const keyword of keywords) {
    if (queryLower.includes(keyword)) {
      return 1.3 // 30% boost for category context
    }
  }

  return 1.0 // No boost
}

/**
 * Smart suggestions based on partial input
 */
export function generateSmartSuggestions(
  itemsByCategory: Record<MentionCategory, AnyMentionItem[]>,
  partialQuery: string,
  maxSuggestions: number = 5
): AnyMentionItem[] {
  const engine = new FuzzySearchEngine({ threshold: 0.05 })
  const allItems = Object.values(itemsByCategory).flat()
  
  if (!partialQuery.trim()) {
    // Return most commonly used items (mock data for now)
    return allItems.slice(0, maxSuggestions)
  }

  const results = engine.search(allItems, partialQuery)
  return results.slice(0, maxSuggestions).map(r => r.item)
}

// Export default search engine instance
export const defaultSearchEngine = new FuzzySearchEngine()

// AIDEV-NOTE: This provides comprehensive fuzzy search with context awareness
// AIDEV-NOTE: Supports acronym matching, highlighting, and category-specific boosting
// AIDEV-NOTE: Easily extensible for ML-based suggestions and custom scoring