'use client'

import React, { useState, useEffect, useCallback } from "react";
import { createOrganization, generateOrganizationSlug, checkOrganizationSlugAvailability } from "@/app/actions/setup";
import { useRouter } from "next/navigation";

export function SetupForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [slugError, setSlugError] = useState<string | null>(null);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const router = useRouter();

  // Debounced slug availability check
  useEffect(() => {
    if (!slug || slug.length < 2) {
      setSlugAvailable(null);
      setSlugError(null);
      return;
    }

    // Validate slug format client-side first
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setSlugError("Slug can only contain lowercase letters, numbers, and hyphens");
      setSlugAvailable(false);
      return;
    }

    if (slug.length > 50) {
      setSlugError("Slug must be 50 characters or less");
      setSlugAvailable(false);
      return;
    }

    // Debounce the availability check
    const timeoutId = setTimeout(async () => {
      setCheckingSlug(true);
      setSlugError(null);

      try {
        const result = await checkOrganizationSlugAvailability(slug);
        if (result.success && result.data) {
          setSlugAvailable(result.data.available);
          if (!result.data.available) {
            setSlugError("This slug is already taken");
          }
        } else {
          setSlugError(result.error || "Could not check slug availability");
          setSlugAvailable(false);
        }
      } catch (err) {
        setSlugError("Error checking slug availability");
        setSlugAvailable(false);
      } finally {
        setCheckingSlug(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [slug]);

  // Auto-generate slug from organization name
  const handleNameChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;

    if (name && name.trim().length > 0) {
      try {
        const result = await generateOrganizationSlug(name);
        if (result.success && result.data?.slug) {
          setSlug(result.data.slug);
        }
      } catch (err) {
        console.error("Error generating slug:", err);
      }
    }
  }, []);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    try {
      const result = await createOrganization(formData);

      if (result.success) {
        // Use window.location.href to navigate and reload in one action
        // This ensures session is updated with new organization before rendering billing page
        window.location.href = "/settings/billing?welcome=true";
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
          onChange={handleNameChange}
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

      <div>
        <label htmlFor="organizationSlug" className="block text-sm font-medium text-gray-700">
          Organization Slug *
        </label>
        <input
          type="text"
          id="organizationSlug"
          name="organizationSlug"
          required
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
            slugError
              ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
              : slugAvailable === true
              ? 'border-green-300 focus:ring-green-500 focus:border-green-500'
              : 'border-gray-300'
          }`}
          placeholder="acme-corp"
        />
        <div className="mt-1 min-h-[20px]">
          {checkingSlug && (
            <p className="text-xs text-gray-500">Checking availability...</p>
          )}
          {!checkingSlug && slugError && (
            <p className="text-xs text-red-600">{slugError}</p>
          )}
          {!checkingSlug && !slugError && slugAvailable === true && (
            <p className="text-xs text-green-600">This slug is available!</p>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Lowercase letters, numbers, and hyphens only (2-50 characters)
        </p>
      </div>

      {error && (
        <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || slugAvailable !== true || !!slugError}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Setting up..." : "Complete Setup"}
      </button>

      <div className="text-xs text-gray-500 mt-4">
        <p>This will create your first organization and set you as the owner.</p>
      </div>
    </form>
  );
}
