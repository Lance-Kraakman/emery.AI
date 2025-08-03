import { db } from "./client";
import { sql } from "drizzle-orm";

export async function createDynamicTable(tableName: string) {
  await db.execute(sql.raw(`
    CREATE TABLE ${tableName} (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `));
}

export async function addFieldToTable(tableName: string, slug: string, type: string, required: boolean = false) {
  const typeMap: Record<string, string> = {
    text: "TEXT",
    number: "INTEGER",
    boolean: "BOOLEAN", 
    relation: "UUID",
  };

  const sqlType = typeMap[type] ?? "TEXT";
  const nullable = required ? "NOT NULL" : "";
  
  await db.execute(sql.raw(`
    ALTER TABLE ${tableName} 
    ADD COLUMN field_${slug} ${sqlType} ${nullable};
  `));
}

export async function removeFieldFromTable(tableName: string, slug: string) {
  await db.execute(sql.raw(`
    ALTER TABLE ${tableName} 
    DROP COLUMN IF EXISTS field_${slug};
  `));
}

export async function insertRow(tableName: string, data: Record<string, any>) {
  const fields = Object.keys(data);
  const values = Object.values(data);
  
  if (fields.length === 0) {
    await db.execute(sql.raw(`INSERT INTO ${tableName} DEFAULT VALUES`));
    return;
  }

  const fieldNames = fields.map(field => `"${field}"`).join(", ");
  const placeholders = fields.map((_, i) => `$${i + 1}`).join(", ");
  
  await db.execute(sql.raw(`
    INSERT INTO ${tableName} (${fieldNames}) 
    VALUES (${placeholders})
  `, ...values));
}

export async function updateRow(tableName: string, id: string, data: Record<string, any>) {
  const fields = Object.keys(data);
  const values = Object.values(data);
  
  if (fields.length === 0) return;

  const setClause = fields.map((field, i) => `"${field}" = $${i + 1}`).join(", ");
  
  await db.execute(sql.raw(`
    UPDATE ${tableName} 
    SET ${setClause}, updated_at = now()
    WHERE id = $${fields.length + 1}
  `, ...values, id));
}

export async function deleteRow(tableName: string, id: string) {
  await db.execute(sql.raw(`
    DELETE FROM ${tableName} 
    WHERE id = $1
  `, id));
}

export async function getRows(tableName: string, limit: number = 100, offset: number = 0) {
  const result = await db.execute(sql.raw(`
    SELECT * FROM ${tableName} 
    ORDER BY created_at DESC 
    LIMIT $1 OFFSET $2
  `, limit, offset));
  
  return result.rows;
}

export async function dropDynamicTable(tableName: string) {
  await db.execute(sql.raw(`DROP TABLE IF EXISTS ${tableName};`));
}