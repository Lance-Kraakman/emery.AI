import { auth } from "@/lib/auth";
import { checkSetupStatus } from "@/app/actions/setup";
import { redirect } from "next/navigation";
import { SetupForm } from "./SetupForm";

export default async function SetupPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/signin");
  }

  const { needsSetup, isFirstUser } = await checkSetupStatus();

  // Redirect to dashboard if setup is already complete
  if (!needsSetup) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {isFirstUser ? "Welcome to Orchastrate!" : "Complete Your Setup"}
          </h1>
          <p className="text-gray-600 mt-2">
            {isFirstUser 
              ? "Let's set up your organization and create your admin account."
              : "You need to be assigned to an organization and role to continue."
            }
          </p>
        </div>

        {isFirstUser ? (
          <SetupForm />
        ) : (
          <div className="text-center">
            <p className="text-gray-600 mb-4">
              Please contact your administrator to assign you to an organization and role.
            </p>
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-sm text-gray-500">
                User: {session.user.name || session.user.email}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}