ALTER TABLE "views" ADD COLUMN "requires_auth" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE POLICY "fields_public_via_view" ON "fields" AS PERMISSIVE FOR SELECT TO public USING (EXISTS (
      SELECT 1 FROM views v
      WHERE v.table_id = table_id
      AND v.requires_auth = false
    ));--> statement-breakpoint
CREATE POLICY "views_public_access" ON "views" AS PERMISSIVE FOR SELECT TO public USING (requires_auth = false);