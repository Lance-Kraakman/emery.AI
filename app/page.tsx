import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { checkSetupStatus } from "@/app/actions/setup"; 

export default async function RootPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/signin");
  }

  // Check if user needs initial setup
  const { needsSetup } = await checkSetupStatus();
  if (needsSetup) {
    redirect("/setup");
  }

  // Redirect authenticated users to mission control
  redirect("/mission-control");
}