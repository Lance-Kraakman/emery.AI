import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { checkSetupStatus } from "@/app/actions/setup"; 
import DashboardWithData from './components/DashboardWithData';

export default async function Dashboard() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/signin");
  }

  // Check if user needs initial setup
  const { needsSetup } = await checkSetupStatus();
  if (needsSetup) {
    redirect("/setup");
  }

  return <DashboardWithData />;
}