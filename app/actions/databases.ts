"use server"

import { db } from "@/lib/db/client"
import { databases } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { z } from "zod"
import { revalidatePath } from "next/cache"

// AIDEV-NOTE: Database management server actions with metadata support for RAG indexing

const createDatabaseSchema = z.object({
  name: z.string().min(1, "Database name is required"),
  description: z.string().optional(),
})

const updateDatabaseSchema = z.object({
  id: z.number(),
  name: z.string().min(1, "Database name is required"),
  description: z.string().optional(),
})

export async function getDatabases() {
  const session = await auth()
  if (!session?.user?.currentOrganizationId) {
    throw new Error("Not authenticated or no organization selected")
  }

  try {
    const dbList = await db
      .select()
      .from(databases)
      .where(eq(databases.organizationId, session.user.currentOrganizationId))
      .orderBy(databases.createdAt)
    
    return dbList
  } catch (error) {
    console.error('Error fetching databases:', error)
    throw new Error('Failed to fetch databases')
  }
}

export async function getDatabase(id: number) {
  const session = await auth()
  if (!session?.user?.currentOrganizationId) {
    throw new Error("Not authenticated or no organization selected")
  }

  try {
    const database = await db
      .select()
      .from(databases)
      .where(and(
        eq(databases.id, id),
        eq(databases.organizationId, session.user.currentOrganizationId)
      ))
      .limit(1)
    
    if (database.length === 0) {
      throw new Error("Database not found")
    }
    
    return database[0]
  } catch (error) {
    console.error('Error fetching database:', error)
    throw new Error('Failed to fetch database')
  }
}

export async function createDatabase(data: z.infer<typeof createDatabaseSchema>, revalidateUrl?: string) {
  const session = await auth()
  if (!session?.user?.currentOrganizationId || !session?.user?.id) {
    throw new Error("Not authenticated or no organization selected")
  }

  try {
    const validatedData = createDatabaseSchema.parse(data)
    
    // Create URL-safe slug
    const baseSlug = validatedData.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    
    // Ensure unique slug by checking existing databases
    let slug = baseSlug
    let counter = 1
    while (true) {
      const existing = await db
        .select()
        .from(databases)
        .where(eq(databases.slug, slug))
        .limit(1)
      
      if (existing.length === 0) break
      
      slug = `${baseSlug}-${counter}`
      counter++
    }

    const metadata = validatedData.description 
      ? { description: validatedData.description }
      : null

    const result = await db
      .insert(databases)
      .values({
        name: validatedData.name,
        slug,
        metadata,
        organizationId: session.user.currentOrganizationId,
        createdBy: session.user.id,
      })
      .returning()

    // Note: RAG reindexing is now handled automatically by database triggers

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl)
    } else {
      revalidatePath('/data') // Default path for database operations
    }

    return { success: true, data: result[0] }
  } catch (error) {
    console.error('Error creating database:', error)
    
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: "Invalid input: " + error.errors.map(e => e.message).join(", ") 
      }
    }
    
    return { success: false, error: "Failed to create database" }
  }
}

export async function updateDatabase(data: z.infer<typeof updateDatabaseSchema>, revalidateUrl?: string) {
  const session = await auth()
  if (!session?.user?.currentOrganizationId) {
    throw new Error("Not authenticated or no organization selected")
  }

  try {
    const validatedData = updateDatabaseSchema.parse(data)
    
    const metadata = validatedData.description 
      ? { description: validatedData.description }
      : null

    const result = await db
      .update(databases)
      .set({
        name: validatedData.name,
        metadata,
        updatedAt: new Date(),
      })
      .where(and(
        eq(databases.id, validatedData.id),
        eq(databases.organizationId, session.user.currentOrganizationId)
      ))
      .returning()

    if (result.length === 0) {
      return { success: false, error: "Database not found" }
    }

    // Note: RAG reindexing is now handled automatically by database triggers

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl)
    } else {
      revalidatePath('/data') // Default path for database operations
    }

    return { success: true, data: result[0] }
  } catch (error) {
    console.error('Error updating database:', error)
    
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: "Invalid input: " + error.errors.map(e => e.message).join(", ") 
      }
    }
    
    return { success: false, error: "Failed to update database" }
  }
}

export async function deleteDatabase(id: number, revalidateUrl?: string) {
  const session = await auth()
  if (!session?.user?.currentOrganizationId) {
    throw new Error("Not authenticated or no organization selected")
  }

  try {
    // Check if database has tables - prevent deletion if it does
    const tablesCount = await db.query.tables.findMany({
      where: (tables, { eq }) => eq(tables.databaseId, id)
    })

    if (tablesCount.length > 0) {
      return { 
        success: false, 
        error: `Cannot delete database: it contains ${tablesCount.length} table(s). Delete all tables first.` 
      }
    }

    const result = await db
      .delete(databases)
      .where(and(
        eq(databases.id, id),
        eq(databases.organizationId, session.user.currentOrganizationId)
      ))
      .returning()

    if (result.length === 0) {
      return { success: false, error: "Database not found" }
    }

    // Note: RAG reindexing is now handled automatically by database triggers

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl)
    } else {
      revalidatePath('/data') // Default path for database operations
    }

    return { success: true }
  } catch (error) {
    console.error('Error deleting database:', error)
    return { success: false, error: "Failed to delete database" }
  }
}