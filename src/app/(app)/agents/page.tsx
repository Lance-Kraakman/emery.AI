import { redirect } from 'next/navigation';
import { getAgents } from '@/app/actions/agents';

// AIDEV-NOTE: Agents list now shown in sidebar
// This page redirects to first agent or mission-control

export default async function AgentsPage() {
  const agents = await getAgents();

  // Redirect to first agent if exists, otherwise to mission-control
  if (agents && agents.length > 0) {
    redirect(`/agents/${agents[0].id}`);
  }

  redirect("/mission-control/dashboard");
}
