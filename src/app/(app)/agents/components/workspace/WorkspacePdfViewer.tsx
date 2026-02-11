'use client';

import React, { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, FileText } from 'lucide-react';
import { pdfjs } from 'react-pdf';
import { PDFViewer, PdfFocusProvider } from '@llamaindex/pdf-viewer';
import '@llamaindex/pdf-viewer/index.css';

// Configure PDF.js worker via CDN (required for react-pdf in Next.js)
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface WorkspacePdfViewerProps {
  filePath: string;
  url: string;
}

/**
 * Workspace PDF viewer component
 * Shows in RightPanel when a PDF file is selected from workspace
 */
export function WorkspacePdfViewer({ filePath, url }: WorkspacePdfViewerProps) {
  const fileName = filePath.split('/').pop() || 'document.pdf';

  const handleDownload = useCallback(() => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [url, fileName]);

  const handleExternalOpen = useCallback(() => {
    window.open(url, '_blank');
  }, [url]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/10">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <FileText className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-sm truncate">{fileName}</h3>
            <p className="text-xs text-muted-foreground truncate">
              PDF Document
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="text-xs"
          >
            <Download className="w-3 h-3 mr-1" />
            Download
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExternalOpen}
            className="text-xs"
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            Open
          </Button>
        </div>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-hidden bg-gray-100">
        <PdfFocusProvider>
          <PDFViewer
            file={{
              id: filePath,
              url: url,
            }}
            containerClassName="h-full"
          />
        </PdfFocusProvider>
      </div>
    </div>
  );
}
