import { auth } from "@/lib/auth";
import { checkSetupStatus } from "@/app/actions/setup";
import { redirect } from "next/navigation";
import MissionControlClient from '../MissionControlClient'
import React, { Suspense } from "react";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const { needsSetup } = await checkSetupStatus();

  // Redirect to setup if user hasn't completed organization setup
  if (needsSetup) {
    redirect("/setup");
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MissionControlClient />
    </Suspense>
  );
}
