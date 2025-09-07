import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PermissionsManager } from "./components/PermissionsManager";

export default async function PermissionsPage() {
  const session = await auth();

  if (!session?.user?.currentOrganizationId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Organization Selected</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Please select an organization to manage permissions.</p>
          <p className="text-sm text-muted-foreground mt-2">
            You can switch or create organizations using the switcher in the sidebar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Users & Permissions</h1>
          <p className="text-muted-foreground mt-2">
            Manage user roles, agent task permissions, and team access controls for your organization.
          </p>
        </div>
        
        <PermissionsManager />
      </div>
    </div>
  );
}