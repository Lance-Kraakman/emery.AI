import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { EmeryProviders } from '@/components/EmeryProviders';
import { ConnectionsManager } from "./ConnectionsManager";

export default async function ConnectionsPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/signin");
  }

  return (
    <EmeryProviders>
      <div className="container mx-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">OAuth Connections</h1>
            <p className="text-muted-foreground mt-2">
              Manage your OAuth connections that your agents can use to access external services.
            </p>
          </div>
          
          <ConnectionsManager />
        </div>
      </div>
    </EmeryProviders>
  );
}