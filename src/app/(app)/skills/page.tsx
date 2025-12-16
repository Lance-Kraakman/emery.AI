import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getSkillsByOrganization } from '@/app/actions/skills';

// AIDEV-NOTE: Skills list now shown in sidebar
// This page redirects to first skill or mission-control

export default async function OrganizationSkillsPage() {
  const session = await auth();

  if (!session?.user?.currentOrganizationId) {
    redirect('/mission-control/dashboard');
  }

  // Fetch organization skills
  const skillsResult = await getSkillsByOrganization(session.user.currentOrganizationId);
  const skills = skillsResult.success ? skillsResult.data : [];

  // Redirect to first skill if exists, otherwise to mission-control
  if (skills && skills.length > 0) {
    redirect(`/skills/${skills[0].id}`);
  }

  redirect("/mission-control/dashboard");
}
