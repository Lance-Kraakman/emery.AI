import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ConnectionsManager } from "./ConnectionsManager";

export default async function ConnectionsPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/signin");
  }

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">OAuth Connections</h1>
          <p className="text-gray-600 mt-2">
            Manage your OAuth connections that your agents can use to access external services.
          </p>
        </div>
        
        <ConnectionsManager />
      </div>
    </div>
  );
}