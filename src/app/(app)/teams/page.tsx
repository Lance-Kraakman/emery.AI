import { redirect } from 'next/navigation';
import { getTeams } from '@/app/actions/teams';

// AIDEV-NOTE: Teams list now shown in sidebar
// This page redirects to first team or mission-control

export default async function TeamsPage() {
  const teams = await getTeams();

  // Redirect to first team if exists, otherwise to mission-control
  if (teams && teams.length > 0) {
    redirect(`/teams/${teams[0].id}`);
  }

  redirect("/mission-control/dashboard");
}