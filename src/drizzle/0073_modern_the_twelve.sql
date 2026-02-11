CREATE TABLE "user_ssh_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" integer,
	"public_key" text NOT NULL,
	"fingerprint" text NOT NULL,
	"name" text DEFAULT 'Desktop Sync' NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_ssh_keys_user_fingerprint_unique" UNIQUE("user_id","fingerprint")
);
--> statement-breakpoint
ALTER TABLE "user_ssh_keys" ADD CONSTRAINT "user_ssh_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_ssh_keys" ADD CONSTRAINT "user_ssh_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_ssh_keys_user_idx" ON "user_ssh_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_ssh_keys_fingerprint_idx" ON "user_ssh_keys" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "user_ssh_keys_org_idx" ON "user_ssh_keys" USING btree ("organization_id");