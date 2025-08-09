import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { checkSetupStatus } from "@/app/actions/setup"; 
import { EmeryProviders } from '@/components/EmeryProviders';
import DashboardMainContent from './components/DashboardMainContent';

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

  return (
    <EmeryProviders>
      <DashboardMainContent />
    </EmeryProviders>
  );
}