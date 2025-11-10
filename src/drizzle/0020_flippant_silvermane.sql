CREATE TABLE "token_usage_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"user_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"agent_id" integer,
	"model_name" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" double precision DEFAULT 0 NOT NULL,
	"processing_time_ms" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "token_usage_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "default_model" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "default_model" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "available_models" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "token_quota_monthly" integer;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "token_usage_current_month" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "quota_reset_at" timestamp;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "token_usage_logs" ADD CONSTRAINT "token_usage_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_usage_logs" ADD CONSTRAINT "token_usage_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_usage_logs" ADD CONSTRAINT "token_usage_logs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "token_usage_organization_idx" ON "token_usage_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "token_usage_user_idx" ON "token_usage_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "token_usage_entity_idx" ON "token_usage_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "token_usage_created_at_idx" ON "token_usage_logs" USING btree ("created_at");--> statement-breakpoint
CREATE POLICY "token_usage_view_permission" ON "token_usage_logs" AS PERMISSIVE FOR SELECT TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND (
        user_id = current_setting('app.current_user_id')::uuid
        OR user_has_permission(
          current_setting('app.current_user_id')::uuid,
          'organizations:manage',
          organization_id
        )
      ));