import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";

export default async function RootPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/signin");
  }

  // Redirect authenticated users to mission control
  redirect("/mission-control");
}
