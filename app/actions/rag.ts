'use server'

import { auth } from '@/lib/auth'
import { ragService } from '@/lib/rag/service'
import { revalidatePath } from 'next/cache'

export async function createRagIndex(params: {
  name: string
  description?: string
  domainTypes: string[]
  domainFilters?: any
}) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    // AIDEV-TODO: Get organization from session when RBAC is implemented
    const organizationId = 1 // Placeholder - will use session.user.organizationId

    const indexId = await ragService.createIndex({
      ...params,
      organizationId,
      createdBy: session.user.id,
    })

    revalidatePath('/mission-control')
    return { success: true, indexId }
  } catch (error) {
    console.error('Failed to create RAG index:', error)
    return { success: false, error: 'Failed to create RAG index' }
  }
}

export async function listRagIndexes() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    // AIDEV-TODO: Use actual organization from session
    const organizationId = 1

    const indexes = await ragService.listIndexes({ organizationId })
    return { success: true, indexes }
  } catch (error) {
    console.error('Failed to list RAG indexes:', error)
    return { success: false, error: 'Failed to list RAG indexes' }
  }
}

export async function searchRagIndex(params: {
  indexId: string
  query: string
  limit?: number
}) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    const result = await ragService.search({
      ...params,
      userId: session.user.id,
    })

    return { success: true, result }
  } catch (error) {
    console.error('Failed to search RAG index:', error)
    return { success: false, error: 'Failed to search RAG index' }
  }
}

export async function reindexRagIndex(indexId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    await ragService.reindexData(indexId)
    
    revalidatePath('/mission-control')
    return { success: true }
  } catch (error) {
    console.error('Failed to reindex RAG index:', error)
    return { success: false, error: 'Failed to reindex RAG index' }
  }
}

export async function deleteRagIndex(indexId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    await ragService.deleteIndex(indexId)
    
    revalidatePath('/mission-control')
    return { success: true }
  } catch (error) {
    console.error('Failed to delete RAG index:', error)
    return { success: false, error: 'Failed to delete RAG index' }
  }
}