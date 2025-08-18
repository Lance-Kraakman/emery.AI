CREATE TABLE "rag_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rag_index_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"source_name" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"embedding" vector(1536),
	"content_hash" text NOT NULL,
	"indexed_at" timestamp DEFAULT now(),
	"source_updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "rag_indexes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"organization_id" integer,
	"agent_id" integer,
	"role_id" integer,
	"domain_types" jsonb NOT NULL,
	"domain_filters" jsonb,
	"embedding_model" text DEFAULT 'text-embedding-ada-002',
	"embedding_dimensions" integer DEFAULT 1536,
	"status" text DEFAULT 'active',
	"last_indexed_at" timestamp,
	"document_count" integer DEFAULT 0,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rag_query_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rag_index_id" uuid NOT NULL,
	"query" text NOT NULL,
	"query_embedding" vector(1536),
	"results_count" integer NOT NULL,
	"top_results" jsonb,
	"user_id" uuid,
	"agent_id" integer,
	"session_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "rag_documents" ADD CONSTRAINT "rag_documents_rag_index_id_rag_indexes_id_fk" FOREIGN KEY ("rag_index_id") REFERENCES "public"."rag_indexes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_indexes" ADD CONSTRAINT "rag_indexes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_indexes" ADD CONSTRAINT "rag_indexes_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_indexes" ADD CONSTRAINT "rag_indexes_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_indexes" ADD CONSTRAINT "rag_indexes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_query_logs" ADD CONSTRAINT "rag_query_logs_rag_index_id_rag_indexes_id_fk" FOREIGN KEY ("rag_index_id") REFERENCES "public"."rag_indexes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_query_logs" ADD CONSTRAINT "rag_query_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_query_logs" ADD CONSTRAINT "rag_query_logs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;