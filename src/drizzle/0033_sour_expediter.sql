CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"stripe_invoice_id" text,
	"stripe_subscription_id" text,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"included_credits_used" integer DEFAULT 0 NOT NULL,
	"overage_credits_used" integer DEFAULT 0 NOT NULL,
	"total_credits_used" integer DEFAULT 0 NOT NULL,
	"subscription_amount_usd" numeric(10, 2) DEFAULT '0' NOT NULL,
	"overage_amount_usd" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_amount_usd" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"invoiced_at" timestamp,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	CONSTRAINT "invoices_stripe_invoice_id_unique" UNIQUE("stripe_invoice_id")
);
--> statement-breakpoint
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "usage_allowance_credits" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "spending_limit_usd" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "custom_price_id" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "billing_email" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "current_period_start" timestamp;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "current_period_end" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoices_organization_idx" ON "invoices" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invoices_stripe_invoice_idx" ON "invoices" USING btree ("stripe_invoice_id");--> statement-breakpoint
CREATE INDEX "invoices_period_idx" ON "invoices" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE POLICY "invoices_view_permission" ON "invoices" AS PERMISSIVE FOR SELECT TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'organizations:manage',
        organization_id
      ));