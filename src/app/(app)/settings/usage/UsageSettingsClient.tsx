'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModelSelector } from '@/components/ai/ModelSelector';
import { Sparkles, Save, RefreshCw, Coins, Download } from 'lucide-react';
import { useState, useEffect } from 'react';
import { updateOrganizationSettings } from '@/app/actions/organizations';
import {
  getCreditUsageStats,
  getCreditBreakdownByModel,
  getCreditBreakdownByAgent,
  getCreditBreakdownByUser,
  getCreditBreakdownByType,
  exportCreditUsageCSV,
} from '@/app/actions/credits';
import { toast } from 'sonner';

export interface UsageSettingsClientProps {
  organizationId: number;
  organizationTier: 'free' | 'pro' | 'enterprise';
  currentModel: string | null;
  availableModels: string[];
  tokenQuota: number | null;
  creditBalance: number;
}

export function UsageSettingsClient({
  organizationId,
  organizationTier,
  currentModel,
  availableModels,
  tokenQuota,
  creditBalance,
}: UsageSettingsClientProps) {
  const [defaultModel, setDefaultModel] = useState<string | null>(currentModel);
  const [monthlyQuota, setMonthlyQuota] = useState<string>(tokenQuota?.toString() || '');
  const [isSaving, setIsSaving] = useState(false);

  // Credit usage state
  const [creditStats, setCreditStats] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [modelBreakdown, setModelBreakdown] = useState<any[]>([]);
  const [agentBreakdown, setAgentBreakdown] = useState<any[]>([]);
  const [userBreakdown, setUserBreakdown] = useState<any[]>([]);
  const [typeBreakdown, setTypeBreakdown] = useState<any[]>([]);
  const [isLoadingBreakdown, setIsLoadingBreakdown] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('model');

  // Load credit usage statistics
  useEffect(() => {
    async function loadStats() {
      try {
        setIsLoadingStats(true);
        const result = await getCreditUsageStats(organizationId);
        if (result.success && result.data) {
          setCreditStats(result.data);
        }
      } catch (error) {
        console.error('Failed to load credit stats:', error);
      } finally {
        setIsLoadingStats(false);
      }
    }

    loadStats();
  }, [organizationId]);

  // Load breakdowns
  useEffect(() => {
    async function loadBreakdowns() {
      try {
        setIsLoadingBreakdown(true);
        const [modelResult, agentResult, userResult, typeResult] = await Promise.all([
          getCreditBreakdownByModel(organizationId),
          getCreditBreakdownByAgent(organizationId),
          getCreditBreakdownByUser(organizationId),
          getCreditBreakdownByType(organizationId),
        ]);

        if (modelResult.success && modelResult.data) setModelBreakdown(modelResult.data);
        if (agentResult.success && agentResult.data) setAgentBreakdown(agentResult.data);
        if (userResult.success && userResult.data) setUserBreakdown(userResult.data);
        if (typeResult.success && typeResult.data) setTypeBreakdown(typeResult.data);
      } catch (error) {
        console.error('Failed to load breakdowns:', error);
      } finally {
        setIsLoadingBreakdown(false);
      }
    }

    loadBreakdowns();
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

  const handleExportCSV = async (dimension: 'model' | 'agent' | 'user' | 'type') => {
    try {
      const result = await exportCreditUsageCSV(organizationId, dimension);
      if (result.success && result.data) {
        // Create download link
        const blob = new Blob([result.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `credit-usage-${dimension}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toast.success('Usage data exported successfully');
      } else {
        throw new Error(result.error || 'Failed to export data');
      }
    } catch (error) {
      console.error('Failed to export CSV:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to export data');
    }
  };

  return (
    <div className="space-y-6">
      {/* Credit Balance Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              <CardTitle className="text-lg">Credit Balance</CardTitle>
            </div>
            <Button variant="outline" size="sm">Buy Credits</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-3xl font-bold">{creditBalance.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">credits available</p>
            </div>
            {creditStats && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm font-medium">Used This Month</p>
                  <p className="text-2xl font-semibold">{creditStats.creditsUsedCurrentMonth?.toLocaleString() || 0}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Executions</p>
                  <p className="text-2xl font-semibold">{creditStats.totalExecutions?.toLocaleString() || 0}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Model Configuration & Tier */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <CardTitle className="text-base">Model Configuration</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
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

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Current Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium capitalize">{organizationTier} Tier</p>
              <p className="text-xs text-muted-foreground">Upgrade for more credits and features</p>
            </div>
            <Button variant="outline" size="sm" className="w-full">Upgrade Plan</Button>
          </CardContent>
        </Card>
      </div>

      {/* Usage Breakdown Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Breakdown</CardTitle>
          <CardDescription>View credit usage by different dimensions</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="model">By Model</TabsTrigger>
              <TabsTrigger value="agent">By Agent</TabsTrigger>
              <TabsTrigger value="user">By User</TabsTrigger>
              <TabsTrigger value="type">By Type</TabsTrigger>
            </TabsList>

            <TabsContent value="model" className="space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => handleExportCSV('model')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
              {isLoadingBreakdown ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : modelBreakdown.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No usage data available</div>
              ) : (
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-2 text-left">Model</th>
                        <th className="p-2 text-right">Credits</th>
                        <th className="p-2 text-right">Executions</th>
                        <th className="p-2 text-right">% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modelBreakdown.map((item, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="p-2">{item.name}</td>
                          <td className="p-2 text-right font-medium">{item.creditsUsed.toFixed(2)}</td>
                          <td className="p-2 text-right">{item.executionCount}</td>
                          <td className="p-2 text-right">{item.percentageOfTotal.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="agent" className="space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => handleExportCSV('agent')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
              {isLoadingBreakdown ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : agentBreakdown.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No usage data available</div>
              ) : (
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-2 text-left">Agent</th>
                        <th className="p-2 text-right">Credits</th>
                        <th className="p-2 text-right">Executions</th>
                        <th className="p-2 text-right">% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentBreakdown.map((item, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="p-2">{item.name}</td>
                          <td className="p-2 text-right font-medium">{item.creditsUsed.toFixed(2)}</td>
                          <td className="p-2 text-right">{item.executionCount}</td>
                          <td className="p-2 text-right">{item.percentageOfTotal.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="user" className="space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => handleExportCSV('user')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
              {isLoadingBreakdown ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : userBreakdown.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No usage data available</div>
              ) : (
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-2 text-left">User</th>
                        <th className="p-2 text-right">Credits</th>
                        <th className="p-2 text-right">Executions</th>
                        <th className="p-2 text-right">% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userBreakdown.map((item, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="p-2">{item.name}</td>
                          <td className="p-2 text-right font-medium">{item.creditsUsed.toFixed(2)}</td>
                          <td className="p-2 text-right">{item.executionCount}</td>
                          <td className="p-2 text-right">{item.percentageOfTotal.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="type" className="space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => handleExportCSV('type')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
              {isLoadingBreakdown ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : typeBreakdown.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No usage data available</div>
              ) : (
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-2 text-left">Type</th>
                        <th className="p-2 text-right">Credits</th>
                        <th className="p-2 text-right">Executions</th>
                        <th className="p-2 text-right">% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {typeBreakdown.map((item, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="p-2 capitalize">{item.name}</td>
                          <td className="p-2 text-right font-medium">{item.creditsUsed.toFixed(2)}</td>
                          <td className="p-2 text-right">{item.executionCount}</td>
                          <td className="p-2 text-right">{item.percentageOfTotal.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
