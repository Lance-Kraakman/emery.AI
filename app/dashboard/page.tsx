import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import DashboardWithData from './components/DashboardWithData';

export default async function Dashboard() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/signin");
  }

  return <DashboardWithData />;
}