CREATE TABLE "credit_purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"package_name" text NOT NULL,
	"credits_purchased" integer NOT NULL,
	"amount_paid_usd" double precision NOT NULL,
	"stripe_payment_intent_id" text,
	"payment_status" text DEFAULT 'completed' NOT NULL,
	"metadata" jsonb,
	"purchased_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_purchases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "credit_balance" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "credits_used_current_month" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "credits_reset_at" timestamp;--> statement-breakpoint
ALTER TABLE "token_usage_logs" ADD COLUMN "credits_used" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_purchases_organization_idx" ON "credit_purchases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "credit_purchases_date_idx" ON "credit_purchases" USING btree ("purchased_at");--> statement-breakpoint
CREATE POLICY "credit_purchases_view_permission" ON "credit_purchases" AS PERMISSIVE FOR SELECT TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'organizations:manage',
        organization_id
      ));