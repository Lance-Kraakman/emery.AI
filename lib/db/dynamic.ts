import { db, rawClient } from "./client";
import { sql } from "drizzle-orm";

// AIDEV-NOTE: Use shared raw client from client.ts to prevent connection leaks
export async function createDynamicTable(tableName: string) {
  await db.execute(sql.raw(`
    CREATE TABLE ${tableName} (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `));
}

export async function addFieldToTable(tableName: string, fieldId: number, type: string, required: boolean = false) {
  const typeMap: Record<string, string> = {
    text: "TEXT",
    number: "INTEGER",
    boolean: "BOOLEAN",
    email: "TEXT",
    url: "TEXT", 
    date: "DATE",
    relation: "JSONB", // Use JSONB for relationships like Baserow
    file: "JSONB", // Use JSONB for file metadata like Baserow
  };

  const sqlType = typeMap[type] ?? "TEXT";
  const nullable = required ? "NOT NULL" : "";
  
  await db.execute(sql.raw(`
    ALTER TABLE ${tableName} 
    ADD COLUMN field_${fieldId} ${sqlType} ${nullable};
  `));
  
  // Add GIN index for JSONB fields (relationships and files)
  if (type === 'relation' || type === 'file') {
    await db.execute(sql.raw(`
      CREATE INDEX IF NOT EXISTS idx_${tableName}_field_${fieldId}_gin 
      ON ${tableName} USING GIN (field_${fieldId});
    `));
  }
}

export async function removeFieldFromTable(tableName: string, fieldId: number) {
  await db.execute(sql.raw(`
    ALTER TABLE ${tableName} 
    DROP COLUMN IF EXISTS field_${fieldId};
  `));
}

export async function insertRow(tableName: string, data: Record<string, any>): Promise<any> {
  const fields = Object.keys(data);
  const values = Object.values(data);
  
  // Use shared client pool
  try {
    let query: string;
    let result: any;
    
    if (fields.length === 0) {
      // Insert with default values and return the new row
      query = `INSERT INTO ${tableName} DEFAULT VALUES RETURNING *`;
      result = await rawClient.unsafe(query);
    } else {
      const fieldNames = fields.map(field => `"${field}"`).join(", ");
      const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
      
      query = `INSERT INTO ${tableName} (${fieldNames}) VALUES (${placeholders}) RETURNING *`;
      result = await rawClient.unsafe(query, values);
    }
    
    console.log(`[INSERT-ROW] Query: ${query}`);
    console.log(`[INSERT-ROW] Values: ${JSON.stringify(values)}`);
    console.log(`[INSERT-ROW] Result: ${JSON.stringify(result[0])}`);
    
    return result[0]; // Return the first (and only) inserted row
  } catch (error) {
    console.error(`[INSERT-ROW] Error inserting row into ${tableName}:`, error);
    throw error;
  }
  // No need to close connection - using shared pool
}

export async function updateRow(tableName: string, id: string, data: Record<string, any>): Promise<any> {
  const fields = Object.keys(data);
  const values = Object.values(data);
  
  if (fields.length === 0) {
    console.log(`[UPDATE-ROW] No fields to update for row ${id} in ${tableName}`);
    return null;
  }

  // Use shared client pool
  
  try {
    const setClause = fields.map((field, i) => `"${field}" = $${i + 1}`).join(", ");
    
    const query = `UPDATE ${tableName} SET ${setClause}, updated_at = now() WHERE id = $${fields.length + 1} RETURNING *`;
    
    console.log(`[UPDATE-ROW] Query: ${query}`);
    console.log(`[UPDATE-ROW] Values: ${JSON.stringify([...values, id])}`);
    
    const result = await rawClient.unsafe(query, [...values, id]);
    
    console.log(`[UPDATE-ROW] Updated ${result.length} rows`);
    
    return result[0]; // Return the updated row
  } catch (error) {
    console.error(`[UPDATE-ROW] Error updating row ${id} in ${tableName}:`, error);
    throw error;
  }
  // No need to close connection - using shared pool
}

export async function deleteRow(tableName: string, id: string) {
  // Use shared client pool
  const query = `DELETE FROM ${tableName} WHERE id = $1`;
  await rawClient.unsafe(query, [id]);
  // No need to close connection - using shared pool
}

export async function getRows(tableName: string, limit: number = 100, offset: number = 0): Promise<any[]> {
  // Use shared client pool
  
  try {
    const query = `SELECT * FROM ${tableName} ORDER BY created_at DESC LIMIT $1 OFFSET $2`;
    
    console.log(`[GET-ROWS] Query: ${query}`);
    console.log(`[GET-ROWS] Parameters: limit=${limit}, offset=${offset}`);
    
    const result = await rawClient.unsafe(query, [limit, offset]);
    
    console.log(`[GET-ROWS] Found ${result.length} rows in ${tableName}`);
    if (result.length > 0) {
      console.log(`[GET-ROWS] Sample row:`, JSON.stringify(result[0]));
    }
    
    return result;
  } catch (error) {
    console.error(`[GET-ROWS] Error fetching rows from ${tableName}:`, error);
    throw error;
  }
  // No need to close connection - using shared pool
}

export async function dropDynamicTable(tableName: string) {
  await db.execute(sql.raw(`DROP TABLE IF EXISTS ${tableName};`));
}