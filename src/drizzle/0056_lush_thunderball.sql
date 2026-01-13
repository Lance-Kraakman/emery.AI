ALTER TABLE "databases" ADD COLUMN "agent_id" integer;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "read_config" jsonb;--> statement-breakpoint
ALTER TABLE "databases" ADD CONSTRAINT "databases_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;