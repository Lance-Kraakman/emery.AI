'use client'

import React, { useState } from "react";
import { createOrganization } from "@/src/app/actions/setup";
import { useRouter } from "next/navigation";

export function SetupForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    try {
      const result = await createOrganization(formData);

      if (result.success) {
        router.push("/mission-control");
        window.location.reload(); // hardcore
      } else {
        setError(result.error || "Setup failed");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="organizationName" className="block text-sm font-medium text-gray-700">
          Organization Name *
        </label>
        <input
          type="text"
          id="organizationName"
          name="organizationName"
          required
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="Acme Corp"
        />
      </div>

      <div>
        <label htmlFor="organizationMission" className="block text-sm font-medium text-gray-700">
          Mission Statement (Optional)
        </label>
        <textarea
          id="organizationMission"
          name="organizationMission"
          rows={3}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="Building innovative solutions..."
        />
      </div>

      {error && (
        <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
      >
        {loading ? "Setting up..." : "Complete Setup"}
      </button>

      <div className="text-xs text-gray-500 mt-4">
        <p>This will create your first organization and set you as the owner.</p>
      </div>
    </form>
  );
}
