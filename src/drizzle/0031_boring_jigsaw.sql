ALTER TABLE "roles" ADD COLUMN "type" text DEFAULT 'custom' NOT NULL;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "team_id" integer;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "roles_type_idx" ON "roles" USING btree ("type");--> statement-breakpoint
CREATE INDEX "roles_owner_idx" ON "roles" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "roles_team_idx" ON "roles" USING btree ("team_id");