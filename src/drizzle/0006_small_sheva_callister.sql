CREATE TABLE "app_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text,
	"icon_url" text,
	"supports_oauth" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tools" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"category" text,
	"app_id" text NOT NULL,
	"icon" text,
	"config" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "tools" ADD CONSTRAINT "tools_app_id_app_types_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app_types"("id") ON DELETE no action ON UPDATE no action;