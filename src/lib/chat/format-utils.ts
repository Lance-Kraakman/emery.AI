/**
 * Format utilities for chat display
 *
 * Encapsulates formatting logic for plans, questions, and answers
 * to be displayed in the chat UI.
 */


/**
 * Plan step structure from planJson
 */
interface PlanStep {
  description: string
  toolName?: string
  toolArgs?: Record<string, unknown>
  status?: 'pending' | 'in_progress' | 'completed' | 'failed'
}

/**
 * Plan structure from planJson
 */
interface Plan {
  id?: string
  goal?: string
  steps?: PlanStep[]
  estimatedActions?: number
  context?: string
  analysis?: string
}

/**
 * Format a plan object to markdown for display in chat
 *
 * @param planJson - JSON string containing the plan
 * @returns Formatted markdown string, or empty string if parsing fails
 */
export function formatPlanToMarkdown(planJson: string): string {
  try {
    const plan: Plan = JSON.parse(planJson)

    const parts: string[] = []

    // Header
    parts.push('## Plan')
    parts.push('')

    // Goal
    if (plan.goal) {
      parts.push(`**Goal:** ${plan.goal}`)
      parts.push('')
    }

    // Context/analysis if available
    if (plan.context) {
      parts.push(`**Context:** ${plan.context}`)
      parts.push('')
    }

    if (plan.analysis) {
      parts.push(`**Analysis:** ${plan.analysis}`)
      parts.push('')
    }

    // Steps
    if (plan.steps && plan.steps.length > 0) {
      parts.push('**Steps:**')
      plan.steps.forEach((step, i) => {
        parts.push(`${i + 1}. ${step.description}`)
      })
    }

    return parts.join('\n')
  } catch {
    // Failed to parse plan JSON
    return ''
  }
}

/**
 * Question with answer for formatting
 */
interface QuestionWithAnswer {
  questionId: string
  question: string
  answer: string
}

/**
 * Format batched question answers as human-readable text
 *
 * Instead of sending raw JSON like {"q_0":"answer1","q_1":"answer2"},
 * formats as:
 * ```
 * 1. What is the scope?
 *    → User's answer here
 *
 * 2. What categories?
 *    → Another answer
 * ```
 *
 * @param questions - Array of questions with their metadata
 * @param answers - Map of questionId to answer text
 * @returns Formatted string for display in chat
 */
export function formatQuestionAnswers(
  questions: Array<{ questionId: string; question: string }>,
  answers: Record<string, string>
): string {
  return questions.map((q, i) => {
    const answer = answers[q.questionId] || '(no answer)'
    return `${i + 1}. ${q.question}\n   → ${answer}`
  }).join('\n\n')
}

/**
 * Format a single question answer for immediate response
 * Used when user selects an option or types a custom answer
 *
 * @param question - The question text
 * @param answer - The user's answer
 * @returns Formatted string
 */
export function formatSingleAnswer(question: string, answer: string): string {
  return `**Q:** ${question}\n**A:** ${answer}`
}

/**
 * Question section structure for clarifying questions
 */
interface QuestionSection {
  agentName: string
  stepId: string
  questions: Array<{
    questionId: string
    question: string
    questionType?: 'text' | 'single_select' | 'multi_select'
    options?: string[]
    context?: string
  }>
}

/**
 * Format clarifying questions as markdown for display in chat history
 *
 * Shows questions as a numbered list with options (if any).
 * This is displayed as an assistant message so users can see what was asked.
 *
 * @param sections - Question sections from the backend
 * @returns Formatted markdown string
 */
export function formatQuestionsForChat(sections: QuestionSection[]): string {
  const parts: string[] = []

  for (const section of sections) {
    for (const q of section.questions) {
      parts.push(`**${q.question}**`)

      if (q.context) {
        parts.push(`_${q.context}_`)
      }

      if (q.options && q.options.length > 0) {
        parts.push('')
        q.options.forEach((opt, i) => {
          parts.push(`${i + 1}. ${opt}`)
        })
      }

      parts.push('')
    }
  }

  return parts.join('\n').trim()
}
