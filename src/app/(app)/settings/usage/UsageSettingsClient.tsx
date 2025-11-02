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

      const response = await fetch('/api/organization/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          defaultModel: defaultModel || null,
          tokenQuotaMonthly: monthlyQuota ? parseInt(monthlyQuota) : null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      // Show success message (you can add toast notification here)
      console.log('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      // Show error message (you can add toast notification here)
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Current Usage Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Current Usage</h2>
        <UsageStatsCard
          stats={usageStats || {
            currentUsage: 0,
            monthlyQuota: tokenQuota || undefined,
            totalCost: 0,
            executionCount: 0,
            modelBreakdown: []
          }}
          loading={isLoadingStats}
          showDetails={true}
          detailsHref="/organization/settings/usage/details"
        />
      </div>

      {/* Model Configuration Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            <CardTitle>Model Configuration</CardTitle>
          </div>
          <CardDescription>
            Configure the default AI model for your organization and set token quotas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Default Model Selection */}
          <div className="space-y-2">
            <Label htmlFor="default-model">Default AI Model</Label>
            <ModelSelector
              value={defaultModel}
              onChange={setDefaultModel}
              organizationTier={organizationTier}
              availableModels={availableModels.length > 0 ? availableModels : undefined}
              showInherit={false}
              requiredCapabilities={['toolCalling']}
            />
            <p className="text-xs text-muted-foreground">
              This model will be used by default for all agents and skills in your organization.
              Individual agents and skills can override this setting.
            </p>
          </div>

          {/* Monthly Token Quota */}
          <div className="space-y-2">
            <Label htmlFor="monthly-quota">Monthly Token Quota</Label>
            <Input
              id="monthly-quota"
              type="number"
              value={monthlyQuota}
              onChange={(e) => setMonthlyQuota(e.target.value)}
              placeholder="Leave empty for unlimited"
              min="0"
            />
            <p className="text-xs text-muted-foreground">
              Set a monthly token limit to control costs. Leave empty for unlimited usage.
              Current tier: <span className="font-medium">{organizationTier.toUpperCase()}</span>
            </p>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Changes will apply to new executions immediately
            </p>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Billing Information */}
      <Card>
        <CardHeader>
          <CardTitle>Billing Information</CardTitle>
          <CardDescription>
            View and manage your billing details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Current Plan</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {organizationTier} tier
                </p>
              </div>
              <Button variant="outline">Upgrade Plan</Button>
            </div>

            {tokenQuota && (
              <div className="flex items-center justify-between pt-4 border-t">
                <div>
                  <p className="font-medium">Monthly Quota</p>
                  <p className="text-sm text-muted-foreground">
                    {tokenQuota.toLocaleString()} tokens per month
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
