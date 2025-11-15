'use client';

import React, { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import type { PageDTO } from '@/app/mappers/puck-page-mapper';
import type { AppDTO } from '@/app/mappers/puck-app-mapper';
import type { OrganizationDTO } from '@/app/mappers/organization-mapper';

interface PublicUrlDisplayProps {
  page: PageDTO;
  app: AppDTO;
  organization: OrganizationDTO | null;
}

export function PublicUrlDisplay({ page, app, organization }: PublicUrlDisplayProps) {
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Build public URL
  const publicUrl = organization?.slug && app.slug && page.slug
    ? `/public/${organization.slug}/${app.slug}/${page.slug}`
    : null;

  const fullPublicUrl = typeof window !== 'undefined' && publicUrl
    ? `${window.location.origin}${publicUrl}`
    : null;

  const handleCopyUrl = async () => {
    if (fullPublicUrl) {
      await navigator.clipboard.writeText(fullPublicUrl);
      setCopiedUrl(true);
      toast.success("URL copied to clipboard!");
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const handleOpenPublicPage = () => {
    if (publicUrl) {
      window.open(publicUrl, '_blank');
    }
  };

  // If page is not public or URL can't be built, show the page slug
  if (!page.isPublic || !publicUrl) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{page.slug}</span>
        {!page.isPublic && (
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            Private
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md border border-border">
      <span
        className="text-xs text-muted-foreground font-mono truncate max-w-[400px]"
        title={fullPublicUrl || undefined}
      >
        {publicUrl}
      </span>
      <button
        onClick={handleCopyUrl}
        className="p-1 hover:bg-background rounded transition-colors"
        title="Copy URL"
      >
        {copiedUrl ? (
          <Check size={14} className="text-green-600" />
        ) : (
          <Copy size={14} className="text-muted-foreground" />
        )}
      </button>
      <button
        onClick={handleOpenPublicPage}
        className="p-1 hover:bg-background rounded transition-colors"
        title="Open in new tab"
      >
        <ExternalLink size={14} className="text-muted-foreground" />
      </button>
      <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded font-medium">
        Public
      </span>
    </div>
  );
}
