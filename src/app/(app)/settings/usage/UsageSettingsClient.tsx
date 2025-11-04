'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModelSelector } from '@/components/ai/ModelSelector';
import { UsageStatsCard } from '@/components/billing/UsageStatsCard';
import { Sparkles, Save, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { updateOrganizationSettings } from '@/app/actions/organizations';
import { toast } from 'sonner';

export interface UsageSettingsClientProps {
  organizationId: number;
  organizationTier: 'free' | 'pro' | 'enterprise';
  currentModel: string | null;
  availableModels: string[];
  tokenQuota: number | null;
}

export function UsageSettingsClient({
  organizationId,
  organizationTier,
  currentModel,
  availableModels,
  tokenQuota,
}: UsageSettingsClientProps) {
  const [defaultModel, setDefaultModel] = useState<string | null>(currentModel);
  const [monthlyQuota, setMonthlyQuota] = useState<string>(tokenQuota?.toString() || '');
  const [isSaving, setIsSaving] = useState(false);
  const [usageStats, setUsageStats] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Load usage statistics
  useEffect(() => {
    async function loadStats() {
      try {
        setIsLoadingStats(true);
        const response = await fetch(`/api/billing/usage?organizationId=${organizationId}`);
        if (response.ok) {
          const data = await response.json();
          setUsageStats(data);
        }
      } catch (error) {
        console.error('Failed to load usage stats:', error);
      } finally {
        setIsLoadingStats(false);
      }
    }

    loadStats();
  }, [organizationId]);

  const handleSave = async () => {
    try {
      setIsSaving(true);

      const result = await updateOrganizationSettings({
        organizationId,
        defaultModel: defaultModel || null,
        tokenQuotaMonthly: monthlyQuota ? parseInt(monthlyQuota) : null,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to save settings');
      }

      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Current Usage Section */}
      <UsageStatsCard
        stats={usageStats || {
          currentUsage: 0,
          monthlyQuota: tokenQuota || undefined,
          totalCost: 0,
          executionCount: 0,
          modelBreakdown: []
        }}
        loading={isLoadingStats}
        showDetails={false}
      />

      {/* Model Configuration & Billing - Side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Model Configuration Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <CardTitle className="text-base">Model Configuration</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Default Model Selection */}
            <div className="space-y-1.5">
              <Label htmlFor="default-model" className="text-sm">Default AI Model</Label>
              <ModelSelector
                value={defaultModel}
                onChange={setDefaultModel}
                organizationTier={organizationTier}
                availableModels={availableModels.length > 0 ? availableModels : undefined}
                showInherit={false}
                requiredCapabilities={['toolCalling']}
              />
            </div>

            {/* Monthly Token Quota */}
            <div className="space-y-1.5">
              <Label htmlFor="monthly-quota" className="text-sm">Monthly Token Quota</Label>
              <Input
                id="monthly-quota"
                type="number"
                value={monthlyQuota}
                onChange={(e) => setMonthlyQuota(e.target.value)}
                placeholder="Unlimited"
                min="0"
                className="h-9"
              />
            </div>

            {/* Save Button */}
            <Button onClick={handleSave} disabled={isSaving} className="w-full mt-2" size="sm">
              {isSaving ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-3 w-3 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Billing Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Billing Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Current Plan</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {organizationTier} tier
                </p>
              </div>
              <Button variant="outline" size="sm">Upgrade</Button>
            </div>

            {tokenQuota && (
              <div className="pt-3 border-t">
                <p className="text-sm font-medium">Monthly Quota</p>
                <p className="text-xs text-muted-foreground">
                  {tokenQuota.toLocaleString()} tokens/month
                </p>
              </div>
            )}

            <div className="pt-3 border-t">
              <p className="text-xs text-muted-foreground">
                Current tier: <span className="font-medium">{organizationTier.toUpperCase()}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
