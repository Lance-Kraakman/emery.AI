import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getApp } from "@/app/actions/puck-apps";
import { CanvasBase } from "@/components/canvas";
import { AppDetailsView } from "../components/AppDetailsView";
import { Suspense } from "react";
import { Loading } from "@/components/ui/loading";
import { CenteredCanvasLayout } from "@/components/layouts/CenteredCanvasLayout";

interface AppPageProps {
  params: Promise<{ id: string }>;
}

export default async function AppPage({ params }: AppPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const { id } = await params;
  const appId = parseInt(id, 10);

  if (isNaN(appId)) {
    redirect("/apps");
  }

  const result = await getApp(appId);

  if (!result.success || !result.data) {
    redirect("/apps");
  }

  return (
    <CenteredCanvasLayout>
      <Suspense fallback={<Loading text="Loading app..." />}>
        <AppDetailsView app={result.data} />
      </Suspense>
    </CenteredCanvasLayout>
  );
}
