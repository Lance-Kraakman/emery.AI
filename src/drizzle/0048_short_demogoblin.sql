CREATE INDEX "userRoles_user_org_idx" ON "user_roles" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "userRoles_user_idx" ON "user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "userRoles_org_idx" ON "user_roles" USING btree ("organization_id");