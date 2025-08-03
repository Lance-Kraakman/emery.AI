// AIDEV-NOTE: Server Component dashboard - simplified version using hybrid approach
// AIDEV-TODO: Implement proper session management to move data fetching server-side

import { UserIdProvider } from './components/UserIdProvider';
import DashboardWithData from './components/DashboardWithData';

export default function Dashboard() {
  return (
    <UserIdProvider>
      <DashboardWithData />
    </UserIdProvider>
  );
}