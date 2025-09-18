'use client';

import React from 'react';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { ExternalLink, FileText, File } from 'lucide-react';
import type { DocumentArrayFieldValue } from '@/src/ddd/domain/tables/value-objects/field-values';

interface DocumentFieldDisplayProps {
  value: DocumentArrayFieldValue;
  fieldName: string;
}

function getDocumentIcon(mimeType?: string) {
  if (!mimeType) return <File className="h-4 w-4" />;

  if (mimeType.includes('text') || mimeType.includes('document')) {
    return <FileText className="h-4 w-4" />;
  }

  return <File className="h-4 w-4" />;
}

export function DocumentFieldDisplay({ value, fieldName }: DocumentFieldDisplayProps) {
  if (!value || !Array.isArray(value) || value.length === 0) {
    return (
      <div className="text-muted-foreground italic">
        No {fieldName.toLowerCase()}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {value.map((document, index) => (
        <div key={document.id || index} className="p-3 border rounded-lg bg-background">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="text-muted-foreground">
                {getDocumentIcon(document.mimeType)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-foreground truncate">
                  {document.documentMetadata?.title || document.name || 'Untitled Document'}
                </h4>
                <div className="flex items-center gap-2 mt-1">
                  {document.mimeType && (
                    <Badge variant="outline" className="text-xs">
                      {document.mimeType}
                    </Badge>
                  )}
                  {document.documentMetadata?.tiptapMetadata?.wordCount && (
                    <Badge variant="secondary" className="text-xs">
                      {document.documentMetadata.tiptapMetadata.wordCount} words
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {document.s3Key && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // TODO: Implement S3 URL generation for viewing
                  console.log('View document:', document.s3Key);
                }}
                className="flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                View
              </Button>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            File: {document.name} ({(document.size / 1024).toFixed(1)} KB)
          </div>
        </div>
      ))}
    </div>
  );
}