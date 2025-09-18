'use client';

import React from 'react';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { Download, File, FileText, Image, Video, Music } from 'lucide-react';
import type { FileArrayFieldValue } from '@/src/ddd/domain/tables/value-objects/field-values';

interface FileFieldDisplayProps {
  value: FileArrayFieldValue;
  fieldName: string;
}

function getFileIcon(mimeType?: string, fileName?: string) {
  if (!mimeType && !fileName) return <File className="h-4 w-4" />;

  const type = mimeType || '';
  const name = fileName || '';

  if (type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name)) {
    return <Image className="h-4 w-4" />;
  }
  if (type.startsWith('video/') || /\.(mp4|webm|ogg|avi|mov)$/i.test(name)) {
    return <Video className="h-4 w-4" />;
  }
  if (type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(name)) {
    return <Music className="h-4 w-4" />;
  }
  if (type.includes('text') || /\.(txt|md|csv)$/i.test(name)) {
    return <FileText className="h-4 w-4" />;
  }

  return <File className="h-4 w-4" />;
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';

  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

export function FileFieldDisplay({ value, fieldName }: FileFieldDisplayProps) {
  if (!value || !Array.isArray(value) || value.length === 0) {
    return (
      <div className="text-muted-foreground italic">
        No {fieldName.toLowerCase()}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {value.map((file, index) => (
        <div key={file.id || index} className="flex items-center justify-between p-3 border rounded-lg bg-background">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="text-muted-foreground">
              {getFileIcon(file.mimeType, file.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-foreground truncate">
                {file.name || 'Unnamed file'}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {file.mimeType && (
                  <Badge variant="outline" className="text-xs">
                    {file.mimeType}
                  </Badge>
                )}
                {file.size && (
                  <span>{formatFileSize(file.size)}</span>
                )}
              </div>
            </div>
          </div>

          {file.s3Key && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // TODO: Implement S3 URL generation for download
                console.log('Download file:', file.s3Key);
              }}
              className="flex items-center gap-1"
            >
              <Download className="h-3 w-3" />
              Download
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}