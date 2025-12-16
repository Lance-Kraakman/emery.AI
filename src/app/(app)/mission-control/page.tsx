import { redirect } from "next/navigation";

// AIDEV-NOTE: Mission Control now has sub-routes for dashboard and org-chart
// Redirect to dashboard as default
export default function MissionControlPage() {
  redirect("/mission-control/dashboard");
}

