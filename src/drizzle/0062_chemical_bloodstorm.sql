CREATE TABLE "published_agent_api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"published_agent_id" integer NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"scopes" jsonb DEFAULT '["task:execute","skill:execute"]'::jsonb NOT NULL,
	"last_used_at" timestamp,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "published_agent_api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "published_agent_oauth_clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"published_agent_id" integer NOT NULL,
	"client_id" text NOT NULL,
	"client_secret_hash" text NOT NULL,
	"name" text NOT NULL,
	"redirect_uris" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"allowed_scopes" jsonb DEFAULT '["task:execute","skill:execute"]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "published_agent_oauth_clients_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "published_agent_usage_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"published_agent_id" integer NOT NULL,
	"api_key_id" integer,
	"request_type" text NOT NULL,
	"skill_name" text,
	"status_code" integer NOT NULL,
	"response_time_ms" integer NOT NULL,
	"client_ip" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "published_agents" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" integer NOT NULL,
	"organization_id" integer NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"published_by" uuid,
	"latest_security_report_id" integer,
	"security_approved_at" timestamp,
	"security_approved_by" uuid,
	"min_security_grade" text DEFAULT 'B' NOT NULL,
	"allow_task_mode" boolean DEFAULT true NOT NULL,
	"allow_skill_mode" boolean DEFAULT true NOT NULL,
	"billing_mode" text DEFAULT 'owner_pays' NOT NULL,
	"rate_limit_per_minute" integer DEFAULT 60 NOT NULL,
	"rate_limit_per_day" integer DEFAULT 1000 NOT NULL,
	"integrations" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "published_agents_agent_id_unique" UNIQUE("agent_id"),
	CONSTRAINT "published_agents_org_slug" UNIQUE("organization_id","slug")
);
--> statement-breakpoint
ALTER TABLE "published_agents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "published_agent_api_keys" ADD CONSTRAINT "published_agent_api_keys_published_agent_id_published_agents_id_fk" FOREIGN KEY ("published_agent_id") REFERENCES "public"."published_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_agent_oauth_clients" ADD CONSTRAINT "published_agent_oauth_clients_published_agent_id_published_agents_id_fk" FOREIGN KEY ("published_agent_id") REFERENCES "public"."published_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_agent_usage_logs" ADD CONSTRAINT "published_agent_usage_logs_published_agent_id_published_agents_id_fk" FOREIGN KEY ("published_agent_id") REFERENCES "public"."published_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_agent_usage_logs" ADD CONSTRAINT "published_agent_usage_logs_api_key_id_published_agent_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."published_agent_api_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_agents" ADD CONSTRAINT "published_agents_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_agents" ADD CONSTRAINT "published_agents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_agents" ADD CONSTRAINT "published_agents_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_agents" ADD CONSTRAINT "published_agents_latest_security_report_id_security_reports_id_fk" FOREIGN KEY ("latest_security_report_id") REFERENCES "public"."security_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_agents" ADD CONSTRAINT "published_agents_security_approved_by_users_id_fk" FOREIGN KEY ("security_approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "published_agent_api_keys_published_agent_idx" ON "published_agent_api_keys" USING btree ("published_agent_id");--> statement-breakpoint
CREATE INDEX "published_agent_api_keys_key_hash_idx" ON "published_agent_api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "published_agent_oauth_clients_published_agent_idx" ON "published_agent_oauth_clients" USING btree ("published_agent_id");--> statement-breakpoint
CREATE INDEX "published_agent_oauth_clients_client_id_idx" ON "published_agent_oauth_clients" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "published_agent_usage_logs_published_agent_idx" ON "published_agent_usage_logs" USING btree ("published_agent_id");--> statement-breakpoint
CREATE INDEX "published_agent_usage_logs_created_at_idx" ON "published_agent_usage_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "published_agents_status_idx" ON "published_agents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "published_agents_agent_idx" ON "published_agents" USING btree ("agent_id");--> statement-breakpoint
CREATE POLICY "published_agents_tenant_isolation" ON "published_agents" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_setting('app.current_organization_id')::integer);