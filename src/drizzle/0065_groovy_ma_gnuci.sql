ALTER TABLE "tasks" DROP CONSTRAINT "tasks_skill_id_skills_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE set null ON UPDATE no action;