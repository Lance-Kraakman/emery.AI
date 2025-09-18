"use client";

import { acceptInvitation } from "@/src/app/actions/invitations";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function AcceptInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    startTransition(async () => {
      const { token } = await params
      const result = await acceptInvitation(token);
      if (result.error) {
        setError(result.error);
      } else {
        // Redirect to the organization dashboard or a success page
        router.push("/organization");
      }
    });
  }, [params, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Accepting Invitation</CardTitle>
        </CardHeader>
        <CardContent>
          {isPending && <p>Please wait while we process your invitation...</p>}
          {error && (
            <div>
              <p className="text-red-500">{error}</p>
              <Button onClick={() => router.push("/auth/signin")} className="mt-4">
                Sign In
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
