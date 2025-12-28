import { redirect } from 'next/navigation';

// AIDEV-NOTE: Teams feature coming soon
// Redirecting to dashboard until teams is implemented

export default async function TeamPage() {
  redirect("/dashboard");
}
