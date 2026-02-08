'use client'

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from './dialog';
import { Button } from './button';
import { Badge } from './badge';
import { Card, CardContent } from './card';
import {
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { getConnectionSetupUrl } from '@/app/actions/connections';
import { cn } from '@/lib/utils';

interface ConnectionSetupFlowProps {
  isOpen: boolean;
  onClose: () => void;
  appName: string;
  requiredFor?: string[]; // List of tools that need this connection
  redirectPath?: string;
  onSuccess?: () => void;
}

export function ConnectionSetupFlow({
  isOpen,
  onClose,
  appName,
  requiredFor = [],
  redirectPath,
  onSuccess
}: ConnectionSetupFlowProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetupConnection = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Create redirect URL with current page context
      const currentPath = window.location.pathname;
      const redirectUrl = redirectPath || `${window.location.origin}${currentPath}?connected=${appName}`;

      const result = await getConnectionSetupUrl(appName, redirectUrl);

      if (result.success && result.data) {
        // Use same-tab navigation like Connections page to prevent popup blockers
        // and ensure consistent behavior across the application
        window.location.href = result.data as string;
      } else {
        throw new Error(result.error || 'Failed to generate setup URL');
      }
    } catch (err) {
      console.error('Connection setup error:', err);
      setError(err instanceof Error ? err.message : 'Failed to setup connection');
      setIsLoading(false);
    }
  };

  const getAppInfo = (appName: string) => {
    const appMap: Record<string, { displayName: string; description: string; icon: string }> = {
      'slack': {
        displayName: 'Slack',
        description: 'Send messages, read channels, and manage your Slack workspace',
        icon: '💬'
      },
      'gmail': {
        displayName: 'Gmail',
        description: 'Send emails, read inbox, and manage your Gmail account',
        icon: '📧'
      },
      'google-sheets': {
        displayName: 'Google Sheets',
        description: 'Read and write spreadsheet data in Google Sheets',
        icon: '📊'
      },
      'github': {
        displayName: 'GitHub',
        description: 'Access repositories, issues, and pull requests',
        icon: '🐙'
      },
      'notion': {
        displayName: 'Notion',
        description: 'Read and write pages, databases, and blocks',
        icon: '📝'
      }
    };

    return appMap[appName.toLowerCase()] || {
      displayName: appName,
      description: 'Connect to this external service',
      icon: '🔗'
    };
  };

  const appInfo = getAppInfo(appName);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{appInfo.icon}</span>
            Connect to {appInfo.displayName}
          </DialogTitle>
          <DialogDescription>
            Set up a secure connection to use {appInfo.displayName} tools in your agents.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* App description */}
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                {appInfo.description}
              </p>
            </CardContent>
          </Card>

          {/* Tools that need this connection */}
          {requiredFor.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Required for tools:</p>
              <div className="flex flex-wrap gap-1">
                {requiredFor.map(tool => (
                  <Badge key={tool} variant="secondary" className="text-xs">
                    {tool}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Connection process info */}
          <div className="space-y-2">
            <p className="text-sm font-medium">How it works:</p>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                You&apos;ll be redirected to {appInfo.displayName} to authorize access
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Grant permissions for the tools you want to use
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                You&apos;ll be redirected back here after successful connection
              </div>
            </div>
          </div>

          {/* Error display */}
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-4 w-4" />
                  <p className="text-sm">{error}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSetupConnection} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <ExternalLink className="h-4 w-4 mr-2" />
                Connect to {appInfo.displayName}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface QuickConnectionSetupProps {
  appName: string;
  onSuccess?: () => void;
  size?: 'sm' | 'lg' | 'icon' | 'default';
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
  children?: React.ReactNode;
  className?: string;
}

export function QuickConnectionSetup({
  appName,
  onSuccess,
  size = 'sm',
  variant = 'outline',
  children,
  className
}: QuickConnectionSetupProps) {
  const [showSetup, setShowSetup] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size as 'sm' | 'lg' | 'icon' | 'default'}
        onClick={() => setShowSetup(true)}
        className={className}
      >
        {children || (
          <>
            <ExternalLink className="h-3 w-3 mr-1" />
            Connect {appName}
          </>
        )}
      </Button>

      <ConnectionSetupFlow
        isOpen={showSetup}
        onClose={() => setShowSetup(false)}
        appName={appName}
        onSuccess={onSuccess}
      />
    </>
  );
}

interface BulkConnectionSetupProps {
  isOpen: boolean;
  onClose: () => void;
  missingApps: string[];
  onSuccess?: () => void;
}

export function BulkConnectionSetup({
  isOpen,
  onClose,
  missingApps,
  onSuccess
}: BulkConnectionSetupProps) {
  const [currentAppIndex, setCurrentAppIndex] = useState(0);
  const [completedApps, setCompletedApps] = useState<string[]>([]);

  const currentApp = missingApps[currentAppIndex];
  const isLastApp = currentAppIndex === missingApps.length - 1;

  const handleAppSuccess = () => {
    const newCompletedApps = [...completedApps, currentApp];
    setCompletedApps(newCompletedApps);

    if (isLastApp) {
      // All done
      onSuccess?.();
      onClose();
      setCurrentAppIndex(0);
      setCompletedApps([]);
    } else {
      // Move to next app
      setCurrentAppIndex(currentAppIndex + 1);
    }
  };

  const handleClose = () => {
    onClose();
    setCurrentAppIndex(0);
    setCompletedApps([]);
  };

  if (missingApps.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Setup Multiple Connections</DialogTitle>
          <DialogDescription>
            Connect to {missingApps.length} services to enable all your tools.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress indicator */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{completedApps.length + 1} of {missingApps.length}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${((completedApps.length + 1) / missingApps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Apps list */}
          <div className="space-y-1">
            {missingApps.map((app, index) => (
              <div key={app} className={cn(
                "flex items-center gap-3 p-2 rounded-md text-sm",
                index === currentAppIndex ? "bg-primary/10 border border-primary/20" :
                completedApps.includes(app) ? "bg-green-50 border border-green-200" :
                "bg-gray-50"
              )}>
                {completedApps.includes(app) ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : index === currentAppIndex ? (
                  <ArrowRight className="h-4 w-4 text-primary" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                )}
                <span className={cn(
                  completedApps.includes(app) && "text-green-700",
                  index === currentAppIndex && "text-primary font-medium"
                )}>
                  {app}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Individual connection setup */}
        <ConnectionSetupFlow
          isOpen={true}
          onClose={handleClose}
          appName={currentApp}
          onSuccess={handleAppSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}