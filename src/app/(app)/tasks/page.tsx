import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { TasksClient } from './TasksClient';

/**
 * Tasks Page
 *
 * Unified view for all tasks with tabs:
 * - My Tasks: Human tasks assigned to current user
 * - All Tasks: All organization tasks
 * - Scheduled: Recurring/scheduled task definitions (future)
 */
export default async function TasksPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  if (!session.user.currentOrganizationId) {
    redirect('/mission-control/dashboard');
  }

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-muted-foreground mt-2">
            View and manage tasks across your organization.
          </p>
        </div>

        <TasksClient
          userId={session.user.id}
          organizationId={session.user.currentOrganizationId}
        />
      </div>
    </div>
  );
}
