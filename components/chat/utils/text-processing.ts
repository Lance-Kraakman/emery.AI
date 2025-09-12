/**
 * Pure Text Processing Utilities
 * 
 * Lightweight utility functions for text manipulation, pattern matching,
 * and string processing used throughout the chat reference system.
 * 
 * AIDEV-NOTE: Extracted pure functions from various components to improve
 * testability, reusability, and maintainability. No dependencies on external
 * state or complex frameworks.
 */

// Text normalization and cleaning
export const TextNormalization = {
  /**
   * Normalize text for consistent comparison
   */
  normalize(text: string): string {
    return text.trim().toLowerCase()
  },

  /**
   * Convert text to URL-safe slug format
   */
  toSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Remove consecutive hyphens
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
  },

  /**
   * Clean whitespace and normalize line breaks
   */
  cleanWhitespace(text: string): string {
    return text
      .replace(/\r\n/g, '\n') // Normalize line breaks
      .replace(/\r/g, '\n')
      .replace(/\t/g, '  ') // Convert tabs to spaces
      .replace(/\n{3,}/g, '\n\n') // Limit consecutive line breaks
      .trim()
  },

  /**
   * Remove HTML tags from text
   */
  stripHtml(text: string): string {
    return text.replace(/<[^>]*>/g, '')
  }
}

// Pattern matching utilities
export const PatternMatching = {
  /**
   * Extract reference patterns from text
   * Matches: @doc:name, @table:name, @agent:name, etc.
   */
  extractReferences(text: string): Array<{
    full: string
    type: string
    name: string
    position: number
  }> {
    const referencePattern = /@(doc|document|table|agent|tool|team|setting):([^\s@]+)/gi
    const matches: Array<{
      full: string
      type: string
      name: string
      position: number
    }> = []
    
    let match
    while ((match = referencePattern.exec(text)) !== null) {
      matches.push({
        full: match[0],
        type: match[1].toLowerCase(),
        name: match[2],
        position: match.index
      })
    }
    
    return matches
  },

  /**
   * Check if text contains any reference patterns
   */
  hasReferences(text: string): boolean {
    const referencePattern = /@(doc|document|table|agent|tool|team|setting):[^\s@]+/i
    return referencePattern.test(text)
  },

  /**
   * Extract @ mentions from text (without type prefix)
   */
  extractMentions(text: string): Array<{
    mention: string
    position: number
  }> {
    const mentionPattern = /@([a-zA-Z0-9_-]+)/g
    const matches: Array<{
      mention: string
      position: number
    }> = []
    
    let match
    while ((match = mentionPattern.exec(text)) !== null) {
      matches.push({
        mention: match[1],
        position: match.index
      })
    }
    
    return matches
  },

  /**
   * Check if text looks like a file path
   */
  isFilePath(text: string): boolean {
    return /^[a-zA-Z0-9\/\\._-]+\.[a-zA-Z0-9]+$/.test(text.trim())
  },

  /**
   * Check if text looks like an email
   */
  isEmail(text: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim())
  },

  /**
   * Check if text looks like a URL
   */
  isUrl(text: string): boolean {
    try {
      new URL(text.trim())
      return true
    } catch {
      return false
    }
  }
}

// String similarity and scoring
export const Similarity = {
  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = []
    
    // Initialize first row and column
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }
    
    // Fill in the rest of the matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        const cost = str1[j - 1] === str2[i - 1] ? 0 : 1
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // deletion
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j - 1] + cost // substitution
        )
      }
    }
    
    return matrix[str2.length][str1.length]
  },

  /**
   * Calculate normalized similarity score (0-1, higher is more similar)
   */
  calculateSimilarity(str1: string, str2: string): number {
    const normalizedStr1 = TextNormalization.normalize(str1)
    const normalizedStr2 = TextNormalization.normalize(str2)
    
    if (normalizedStr1 === normalizedStr2) return 1
    
    const maxLength = Math.max(normalizedStr1.length, normalizedStr2.length)
    if (maxLength === 0) return 1
    
    const distance = this.levenshteinDistance(normalizedStr1, normalizedStr2)
    return (maxLength - distance) / maxLength
  },

  /**
   * Check if one string starts with another (case-insensitive)
   */
  startsWithIgnoreCase(text: string, prefix: string): boolean {
    return TextNormalization.normalize(text).startsWith(TextNormalization.normalize(prefix))
  },

  /**
   * Check if one string contains another (case-insensitive)
   */
  containsIgnoreCase(text: string, substring: string): boolean {
    return TextNormalization.normalize(text).includes(TextNormalization.normalize(substring))
  },

  /**
   * Calculate acronym score (how well query matches first letters of words)
   */
  calculateAcronymScore(text: string, query: string): number {
    const words = text.split(/\s+|-|_/).filter(word => word.length > 0)
    const normalizedQuery = TextNormalization.normalize(query)
    
    if (normalizedQuery.length > words.length) return 0
    
    let matches = 0
    for (let i = 0; i < normalizedQuery.length && i < words.length; i++) {
      if (words[i][0] && TextNormalization.normalize(words[i][0]) === normalizedQuery[i]) {
        matches++
      }
    }
    
    return matches / normalizedQuery.length
  }
}

// Text formatting utilities
export const Formatting = {
  /**
   * Truncate text to a maximum length with ellipsis
   */
  truncate(text: string, maxLength: number, ellipsis: string = '...'): string {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength - ellipsis.length) + ellipsis
  },

  /**
   * Highlight matches in text with HTML tags
   */
  highlightMatches(text: string, query: string, className: string = 'highlighted'): string {
    if (!query.trim()) return text
    
    const normalizedQuery = TextNormalization.normalize(query)
    const regex = new RegExp(`(${normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    
    return text.replace(regex, `<span class="${className}">$1</span>`)
  },

  /**
   * Format number with appropriate units (K, M, B)
   */
  formatNumber(num: number): string {
    if (num < 1000) return num.toString()
    if (num < 1000000) return (num / 1000).toFixed(1) + 'K'
    if (num < 1000000000) return (num / 1000000).toFixed(1) + 'M'
    return (num / 1000000000).toFixed(1) + 'B'
  },

  /**
   * Format bytes to human readable size
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  },

  /**
   * Convert camelCase to human readable text
   */
  camelCaseToWords(text: string): string {
    return text
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim()
  },

  /**
   * Generate initials from name
   */
  getInitials(name: string, maxLength: number = 2): string {
    return name
      .split(/\s+/)
      .map(word => word[0]?.toUpperCase())
      .filter(Boolean)
      .slice(0, maxLength)
      .join('')
  }
}

// Validation utilities
export const Validation = {
  /**
   * Check if string is not empty after trimming
   */
  isNotEmpty(text: string): boolean {
    return text.trim().length > 0
  },

  /**
   * Check if string has minimum length
   */
  hasMinLength(text: string, minLength: number): boolean {
    return text.trim().length >= minLength
  },

  /**
   * Check if string has maximum length
   */
  hasMaxLength(text: string, maxLength: number): boolean {
    return text.length <= maxLength
  },

  /**
   * Check if string contains only alphanumeric characters and common symbols
   */
  isSafeText(text: string): boolean {
    return /^[a-zA-Z0-9\s._-]+$/.test(text)
  },

  /**
   * Check if string is a valid identifier (for slugs, IDs, etc.)
   */
  isValidIdentifier(text: string): boolean {
    return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(text)
  }
}

// Array and list processing utilities  
export const ListProcessing = {
  /**
   * Remove duplicates from array of strings (case-insensitive)
   */
  uniqueStringsIgnoreCase(strings: string[]): string[] {
    const seen = new Set<string>()
    return strings.filter(str => {
      const normalized = TextNormalization.normalize(str)
      if (seen.has(normalized)) return false
      seen.add(normalized)
      return true
    })
  },

  /**
   * Sort strings by similarity to a query
   */
  sortBySimilarity(strings: string[], query: string): string[] {
    return strings
      .map(str => ({
        text: str,
        score: Similarity.calculateSimilarity(str, query)
      }))
      .sort((a, b) => b.score - a.score)
      .map(item => item.text)
  },

  /**
   * Group strings by first letter
   */
  groupByFirstLetter(strings: string[]): Record<string, string[]> {
    const groups: Record<string, string[]> = {}
    
    for (const str of strings) {
      const firstLetter = str[0]?.toUpperCase() || '#'
      if (!groups[firstLetter]) groups[firstLetter] = []
      groups[firstLetter].push(str)
    }
    
    return groups
  }
}

// Cache key generation
export const CacheKeys = {
  /**
   * Generate consistent cache key from parameters
   */
  generate(prefix: string, ...params: (string | number | boolean)[]): string {
    const normalized = params
      .map(param => String(param).toLowerCase().trim())
      .filter(Boolean)
      .join(':')
    
    return `${prefix}:${normalized}`
  },

  /**
   * Generate search cache key
   */
  forSearch(query: string, categories: string[], limit?: number): string {
    const categoryKey = categories.sort().join(',')
    const parts = [query.trim().toLowerCase(), categoryKey]
    if (limit) parts.push(String(limit))
    return this.generate('search', ...parts)
  }
}