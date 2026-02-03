'use client';

import React, { useState, useTransition, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  listSecurityReports,
  getSecurityReport,
  generateSecurityReport,
} from '@/app/actions/security';
import type { SecurityReport, SecurityFinding, RiskLevel } from '@/ddd/domain/security/types';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Loader2,
  X,
  ExternalLink,
  Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const riskBadgeStyles: Record<RiskLevel, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  high: 'bg-warning text-warning-foreground',
  medium: 'bg-warning/80 text-warning-foreground',
  low: 'bg-primary text-primary-foreground',
  info: 'bg-muted text-muted-foreground',
};

interface SecurityPanelProps {
  onClose: () => void;
}

export function SecurityPanel({ onClose }: SecurityPanelProps) {
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [findings, setFindings] = useState<SecurityFinding[]>([]);
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<'issues' | 'validated' | 'risk'>('issues');
  const [expandedFinding, setExpandedFinding] = useState<number | null>(null);

  useEffect(() => {
    startTransition(async () => {
      const result = await listSecurityReports(1);
      if (result.success && result.data && result.data.length > 0) {
        const fullResult = await getSecurityReport(result.data[0].id);
        if (fullResult.success && fullResult.data) {
          setReport(fullResult.data.report);
          setFindings(fullResult.data.findings);
        }
      }
    });
  }, []);

  const handleGenerate = () => {
    startTransition(async () => {
      const result = await generateSecurityReport();
      if (result.success && result.data) {
        const fullResult = await getSecurityReport(result.data.id);
        if (fullResult.success && fullResult.data) {
          setReport(fullResult.data.report);
          setFindings(fullResult.data.findings);
        }
      }
    });
  };

  const openFindings = useMemo(
    () => findings.filter((f) => f.status === 'open'),
    [findings]
  );

  // Empty / loading state
  if (isPending && !report) {
    return (
      <PanelShell onClose={onClose}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </PanelShell>
    );
  }

  if (!report) {
    return (
      <PanelShell onClose={onClose}>
        <div className="text-center py-6 px-2">
          <Shield className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm font-medium">No Security Report</p>
          <p className="text-xs text-muted-foreground mt-0.5 mb-3">
            Run an analysis to check your organization.
          </p>
          <Button onClick={handleGenerate} size="sm" disabled={isPending}>
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Shield className="h-3.5 w-3.5 mr-1.5" />}
            Run Analysis
          </Button>
        </div>
      </PanelShell>
    );
  }

  return (
    <PanelShell onClose={onClose}>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex flex-col flex-1 min-h-0">
        <TabsList className="w-full shrink-0 mx-0">
          <TabsTrigger value="issues" className="flex-1 text-xs gap-1">
            Issues
            {openFindings.length > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                {openFindings.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="validated" className="flex-1 text-xs gap-1">
            Validated
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 text-green-600">
              {report.reportData.strengths.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="risk" className="flex-1 text-xs">
            Risk Profiles
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Issues Tab */}
          <TabsContent value="issues" className="mt-0 p-2">
            {openFindings.length === 0 ? (
              <div className="text-center py-4">
                <CheckCircle className="h-6 w-6 mx-auto text-green-500 mb-1" />
                <p className="text-xs text-muted-foreground">No open issues</p>
              </div>
            ) : (
              <div className="space-y-1">
                {openFindings.map((finding) => (
                  <div key={finding.id} className="border rounded-md">
                    <button
                      className="w-full text-left px-2 py-1.5 flex items-start gap-2 hover:bg-muted/50 rounded-md"
                      onClick={() => setExpandedFinding(expandedFinding === finding.id ? null : finding.id)}
                    >
                      <Badge className={cn('text-[10px] px-1 py-0 mt-0.5 shrink-0', riskBadgeStyles[finding.riskLevel])}>
                        {finding.riskLevel}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium truncate">{finding.findingData.title}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{finding.findingData.resource.name}</div>
                      </div>
                    </button>
                    {expandedFinding === finding.id && (
                      <div className="px-2 pb-2 pt-0.5 border-t">
                        <p className="text-[11px] text-muted-foreground mb-1.5">{finding.findingData.description}</p>
                        <div className="bg-muted/30 rounded p-1.5">
                          <div className="text-[10px] font-medium mb-0.5">Recommendation</div>
                          <p className="text-[11px] text-muted-foreground">{finding.findingData.remediation.recommendation}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Validated Tab */}
          <TabsContent value="validated" className="mt-0 p-2">
            {report.reportData.strengths.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-xs text-muted-foreground">No validated checks</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {report.reportData.strengths.map((strength, i) => (
                  <div key={i} className="flex items-start gap-1.5 px-1 py-1">
                    <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-medium">{strength.title}</div>
                      <div className="text-[10px] text-muted-foreground">{strength.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Risk Profiles Tab */}
          <TabsContent value="risk" className="mt-0 p-2">
            {report.reportData.agentProfiles.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-xs text-muted-foreground">No agents to display</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {report.reportData.agentProfiles.map((agent) => (
                  <div key={agent.agentId} className="flex items-center gap-2 px-1 py-1.5 rounded hover:bg-muted/50">
                    <Bot className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium flex-1 truncate">{agent.agentName}</span>
                    <span
                      className={cn(
                        'text-xs font-mono font-medium',
                        agent.riskScore >= 80
                          ? 'text-green-600'
                          : agent.riskScore >= 60
                            ? 'text-yellow-600'
                            : agent.riskScore >= 40
                              ? 'text-orange-600'
                              : 'text-red-600'
                      )}
                    >
                      {agent.riskScore}
                    </span>
                    {agent.findingCount === 0 ? (
                      <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>

      {/* Footer */}
      <div className="shrink-0 border-t px-2 py-1.5">
        <p className="text-[10px] text-muted-foreground mb-1">Based on automated analysis — see full report for details.</p>
        <Link
          href="/organization/settings/security"
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          View Full Report
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </PanelShell>
  );
}

function PanelShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="w-80 max-h-[calc(100%-1rem)] bg-background/50 backdrop-blur-sm border rounded-lg shadow-lg overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Security</span>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      {children}
    </div>
  );
}
