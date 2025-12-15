/**
 * Generate a chat title from the first user message.
 * Uses a lightweight heuristic - first N words, stripped of markdown.
 */
export function generateChatTitleFromMessage(
  message: string,
  maxWords = 6
): string {
  // Strip markdown, code blocks, URLs
  const cleaned = message
    .replace(/```[\s\S]*?```/g, '') // code blocks
    .replace(/`[^`]+`/g, '') // inline code
    .replace(/https?:\/\/\S+/g, '') // URLs
    .replace(/[#*_~\[\]]/g, '') // markdown chars
    .replace(/\n+/g, ' ') // newlines to spaces
    .trim()

  // Take first N words, max 50 chars
  const words = cleaned.split(/\s+/).filter(Boolean).slice(0, maxWords)
  let title = words.join(' ')

  if (title.length > 50) {
    title = title.slice(0, 47) + '...'
  }

  return title || 'New Chat'
}
