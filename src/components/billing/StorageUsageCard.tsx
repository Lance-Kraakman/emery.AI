/**
 * StorageUsageCard Component
 *
 * Displays storage usage with progress bar and category breakdown
 */
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { HardDrive, AlertTriangle, Database, MessageSquare, Sparkles } from 'lucide-react';
import { formatBytes, calculatePercentageUsed, getUsageWarningLevel, getUsageColor } from '@/lib/billing/utils';

export interface StorageUsage {
  totalUsageBytes: number;
  quotaBytes: number;
  databaseStorageBytes: number;
  chatStorageBytes: number;
  skillStorageBytes: number;
  percentageUsed: number;
  availableBytes: number;
}

export interface StorageUsageCardProps {
  usage: StorageUsage;
  tierName?: string;
  onUpgrade?: () => void;
}

export function StorageUsageCard({ usage, tierName, onUpgrade }: StorageUsageCardProps) {
  const warningLevel = getUsageWarningLevel(usage.percentageUsed);
  const progressColor = getUsageColor(usage.percentageUsed);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Storage Usage</CardTitle>
          </div>
          <Badge variant={warningLevel === 'safe' ? 'secondary' : 'destructive'}>
            {usage.percentageUsed}% Used
          </Badge>
        </div>
        <CardDescription>
          {formatBytes(usage.totalUsageBytes)} of {formatBytes(usage.quotaBytes)} used
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Overall Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Storage</span>
            <span className="font-medium">{formatBytes(usage.availableBytes)} available</span>
          </div>
          <Progress value={usage.percentageUsed} className="h-3" />
        </div>

        {/* Warning Alert */}
        {warningLevel === 'warning' && (
          <Alert variant="default" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              You're approaching your storage limit. Consider upgrading to get more space.
            </AlertDescription>
          </Alert>
        )}

        {warningLevel === 'critical' && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Storage quota almost full! Uploads may be blocked soon.{' '}
              {onUpgrade && (
                <button onClick={onUpgrade} className="underline font-medium">
                  Upgrade now
                </button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Category Breakdown */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Storage Breakdown</h4>

          {/* Database Storage */}
          <StorageCategoryRow
            icon={<Database className="h-4 w-4" />}
            label="Database & Files"
            bytes={usage.databaseStorageBytes}
            totalBytes={usage.quotaBytes}
            color="bg-blue-500"
          />

          {/* Chat Storage */}
          <StorageCategoryRow
            icon={<MessageSquare className="h-4 w-4" />}
            label="Chat Attachments"
            bytes={usage.chatStorageBytes}
            totalBytes={usage.quotaBytes}
            color="bg-green-500"
          />

          {/* Skill Storage */}
          <StorageCategoryRow
            icon={<Sparkles className="h-4 w-4" />}
            label="Skill Attachments"
            bytes={usage.skillStorageBytes}
            totalBytes={usage.quotaBytes}
            color="bg-purple-500"
          />
        </div>

        {/* Tier Info */}
        {tierName && (
          <div className="pt-4 border-t text-xs text-muted-foreground">
            <span className="font-medium">{tierName}</span> tier includes {formatBytes(usage.quotaBytes)} of storage
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Individual category row with icon, label, size, and mini progress bar
 */
interface StorageCategoryRowProps {
  icon: React.ReactNode;
  label: string;
  bytes: number;
  totalBytes: number;
  color: string;
}

function StorageCategoryRow({ icon, label, bytes, totalBytes, color }: StorageCategoryRowProps) {
  const percentage = calculatePercentageUsed(bytes, totalBytes);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <div className="text-muted-foreground">{icon}</div>
          <span>{label}</span>
        </div>
        <span className="text-muted-foreground">{formatBytes(bytes)}</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
