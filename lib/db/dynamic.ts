import { db } from "./client";
import { sql } from "drizzle-orm";
import postgres from "postgres";

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

export async function insertRow(tableName: string, data: Record<string, any>) {
  const fields = Object.keys(data);
  const values = Object.values(data);
  
  if (fields.length === 0) {
    await db.execute(sql.raw(`INSERT INTO ${tableName} DEFAULT VALUES`));
    return;
  }

  // Get the raw postgres client from environment
  const client = postgres(process.env.DATABASE_URL!);
  const fieldNames = fields.map(field => `"${field}"`).join(", ");
  const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
  
  const query = `INSERT INTO ${tableName} (${fieldNames}) VALUES (${placeholders})`;
  
  await client.unsafe(query, values);
  await client.end();
}

export async function updateRow(tableName: string, id: string, data: Record<string, any>) {
  const fields = Object.keys(data);
  const values = Object.values(data);
  
  if (fields.length === 0) return;

  const client = postgres(process.env.DATABASE_URL!);
  const setClause = fields.map((field, i) => `"${field}" = $${i + 1}`).join(", ");
  
  const query = `UPDATE ${tableName} SET ${setClause}, updated_at = now() WHERE id = $${fields.length + 1}`;
  
  await client.unsafe(query, [...values, id]);
  await client.end();
}

export async function deleteRow(tableName: string, id: string) {
  const client = postgres(process.env.DATABASE_URL!);
  const query = `DELETE FROM ${tableName} WHERE id = $1`;
  await client.unsafe(query, [id]);
  await client.end();
}

export async function getRows(tableName: string, limit: number = 100, offset: number = 0) {
  const client = postgres(process.env.DATABASE_URL!);
  const query = `SELECT * FROM ${tableName} ORDER BY created_at DESC LIMIT $1 OFFSET $2`;
  const result = await client.unsafe(query, [limit, offset]);
  await client.end();
  
  return result;
}

export async function dropDynamicTable(tableName: string) {
  await db.execute(sql.raw(`DROP TABLE IF EXISTS ${tableName};`));
}