'use client';

import React, { useState, useTransition, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  generateSecurityReport,
  listSecurityReports,
  getSecurityReport,
  updateFindingStatus,
} from '@/app/actions/security';
import type { SecurityReport, SecurityFinding, FindingStatus, RiskLevel, ResourceType } from '@/ddd/domain/security/types';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  ExternalLink,
  AlertCircle,
  XCircle,
  Bot,
  Zap,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const gradeColors: Record<string, string> = {
  A: 'bg-green-500 text-white',
  B: 'bg-green-400 text-white',
  C: 'bg-yellow-500 text-black',
  D: 'bg-orange-500 text-white',
  F: 'bg-red-500 text-white',
};

const riskLevelOrder: RiskLevel[] = ['critical', 'high', 'medium', 'low', 'info'];

const riskBadgeStyles: Record<RiskLevel, string> = {
  critical: 'bg-red-600 text-white hover:bg-red-700',
  high: 'bg-orange-500 text-white hover:bg-orange-600',
  medium: 'bg-yellow-500 text-black hover:bg-yellow-600',
  low: 'bg-blue-500 text-white hover:bg-blue-600',
  info: 'bg-slate-400 text-white hover:bg-slate-500',
};

const statusBadgeStyles: Record<FindingStatus, string> = {
  open: 'bg-red-100 text-red-700 border-red-200',
  acknowledged: 'bg-amber-100 text-amber-700 border-amber-200',
  mitigated: 'bg-green-100 text-green-700 border-green-200',
  false_positive: 'bg-slate-100 text-slate-600 border-slate-200',
};

const statusLabels: Record<FindingStatus, string> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  mitigated: 'Mitigated',
  false_positive: 'False Positive',
};

const resourceTypeIcons: Record<ResourceType, React.ReactNode> = {
  agent: <Bot className="h-4 w-4" />,
  skill: <Zap className="h-4 w-4" />,
  automation: <Settings className="h-4 w-4" />,
  delegation: <Shield className="h-4 w-4" />,
};

const resourceTypeLabels: Record<ResourceType, string> = {
  agent: 'Agents',
  skill: 'Skills',
  automation: 'Automations',
  delegation: 'Delegations',
};

export function SecurityDashboard() {
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [findings, setFindings] = useState<SecurityFinding[]>([]);
  const [reports, setReports] = useState<SecurityReport[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<'overview' | 'findings' | 'validated'>('overview');

  useEffect(() => {
    startTransition(async () => {
      const result = await listSecurityReports(10);
      if (result.success && result.data) {
        setReports(result.data);
        if (result.data.length > 0) {
          const latestReport = result.data[0];
          const fullResult = await getSecurityReport(latestReport.id);
          if (fullResult.success && fullResult.data) {
            setReport(fullResult.data.report);
            setFindings(fullResult.data.findings);
          }
        }
      }
    });
  }, []);

  const handleGenerateReport = () => {
    setError(null);
    startTransition(async () => {
      const result = await generateSecurityReport();
      if (result.success && result.data) {
        const fullResult = await getSecurityReport(result.data.id);
        if (fullResult.success && fullResult.data) {
          setReport(fullResult.data.report);
          setFindings(fullResult.data.findings);
          const reportsResult = await listSecurityReports(10);
          if (reportsResult.success && reportsResult.data) {
            setReports(reportsResult.data);
          }
        }
      } else {
        setError(result.error || 'Failed to generate report');
      }
    });
  };

  const handleUpdateStatus = (findingId: number, status: FindingStatus) => {
    startTransition(async () => {
      const result = await updateFindingStatus(findingId, status);
      if (result.success && result.data) {
        setFindings((prev) => prev.map((f) => (f.id === findingId ? result.data! : f)));
      }
    });
  };

  const toggleRow = (findingId: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(findingId)) {
        next.delete(findingId);
      } else {
        next.add(findingId);
      }
      return next;
    });
  };

  // Group findings by resource type
  const findingsByResource = useMemo(() => {
    const groups: Record<ResourceType, SecurityFinding[]> = {
      agent: [],
      skill: [],
      automation: [],
      delegation: [],
    };
    findings.forEach((f) => {
      const type = f.findingData.resource.type;
      if (groups[type]) {
        groups[type].push(f);
      }
    });
    // Sort each group by severity
    Object.keys(groups).forEach((key) => {
      groups[key as ResourceType].sort(
        (a, b) => riskLevelOrder.indexOf(a.riskLevel) - riskLevelOrder.indexOf(b.riskLevel)
      );
    });
    return groups;
  }, [findings]);

  // Count findings by status
  const findingsByStatus = useMemo(() => {
    return {
      open: findings.filter((f) => f.status === 'open').length,
      acknowledged: findings.filter((f) => f.status === 'acknowledged').length,
      mitigated: findings.filter((f) => f.status === 'mitigated').length,
      false_positive: findings.filter((f) => f.status === 'false_positive').length,
    };
  }, [findings]);

  // Group strengths by category
  const strengthsByCategory = useMemo(() => {
    if (!report) return {};
    const groups: Record<string, typeof report.reportData.strengths> = {};
    report.reportData.strengths.forEach((s) => {
      if (!groups[s.category]) {
        groups[s.category] = [];
      }
      groups[s.category].push(s);
    });
    return groups;
  }, [report]);

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Empty state
  if (!report && !isPending) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <div className="text-center space-y-4">
          <Shield className="h-16 w-16 mx-auto text-muted-foreground/50" />
          <h2 className="text-xl font-semibold">No Security Report</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Run a security analysis to identify vulnerabilities in your organization&apos;s agents,
            skills, and automations.
          </p>
          <Button onClick={handleGenerateReport} size="lg" className="mt-4">
            <Shield className="h-4 w-4 mr-2" />
            Run Security Analysis
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      {/* Report Header */}
      <header className="border-b pb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Security Report</h1>
            {report && (
              <p className="text-muted-foreground mt-1">
                Generated on {formatDate(report.generatedAt)}
              </p>
            )}
          </div>
          <Button onClick={handleGenerateReport} disabled={isPending} variant="outline">
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {isPending ? 'Analyzing...' : 'Regenerate'}
          </Button>
        </div>
      </header>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg border border-destructive/20">
          {error}
        </div>
      )}

      {report && (
        <>
          {/* Score Summary Bar */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {/* Grade */}
            <div className="col-span-2 flex items-center gap-4 p-4 border rounded-lg bg-card">
              <div
                className={cn(
                  gradeColors[report.reportData.riskGrade],
                  'text-3xl font-bold w-14 h-14 rounded-full flex items-center justify-center shadow-sm'
                )}
              >
                {report.reportData.riskGrade}
              </div>
              <div>
                <div className="text-2xl font-bold">{report.reportData.overallScore}/100</div>
                <div className="text-xs text-muted-foreground">Security Score</div>
              </div>
            </div>
            {/* Quick Stats */}
            <StatCard
              icon={<XCircle className="h-4 w-4 text-red-500" />}
              label="Critical"
              value={report.reportData.findingCounts.critical}
              valueClass="text-red-600"
            />
            <StatCard
              icon={<AlertCircle className="h-4 w-4 text-orange-500" />}
              label="High"
              value={report.reportData.findingCounts.high}
              valueClass="text-orange-600"
            />
            <StatCard
              icon={<AlertTriangle className="h-4 w-4 text-yellow-500" />}
              label="Medium"
              value={report.reportData.findingCounts.medium}
              valueClass="text-yellow-600"
            />
            <StatCard
              icon={<CheckCircle className="h-4 w-4 text-green-500" />}
              label="Validated"
              value={report.reportData.strengths.length}
              valueClass="text-green-600"
            />
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="findings" className="flex items-center gap-2">
                Issues
                {findingsByStatus.open > 0 && (
                  <Badge variant="destructive" className="text-xs px-1.5 py-0">
                    {findingsByStatus.open}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="validated" className="flex items-center gap-2">
                Validated
                <Badge variant="outline" className="text-xs px-1.5 py-0 text-green-600">
                  {report.reportData.strengths.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6 mt-6">
              {/* Agent Risk Profiles */}
              {report.reportData.agentProfiles.length > 0 && (
                <section>
                  <h3 className="text-lg font-semibold mb-3">Agent Risk Profiles</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Agent</TableHead>
                          <TableHead className="w-32 text-center">Risk Score</TableHead>
                          <TableHead className="w-32 text-center">Findings</TableHead>
                          <TableHead className="w-24 text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.reportData.agentProfiles.map((agent) => (
                          <TableRow key={agent.agentId}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Bot className="h-4 w-4 text-muted-foreground" />
                                {agent.agentName}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <span
                                className={cn(
                                  'font-mono font-medium',
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
                            </TableCell>
                            <TableCell className="text-center">
                              {agent.findingCount > 0 ? (
                                <Badge variant="outline" className="text-red-600 border-red-200">
                                  {agent.findingCount}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {agent.findingCount === 0 ? (
                                <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-amber-500 mx-auto" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </section>
              )}

              {/* OWASP Compliance */}
              {(report.reportData.owaspViolations.llm2025.length > 0 ||
                report.reportData.owaspViolations.agentic2026.length > 0 ||
                report.reportData.owaspViolations.web2025.length > 0) && (
                <section>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    OWASP Compliance Issues
                  </h3>
                  <div className="border rounded-lg divide-y">
                    {report.reportData.owaspViolations.llm2025.length > 0 && (
                      <div className="p-4 flex items-start gap-4">
                        <div className="text-sm font-medium min-w-[180px]">LLM Top 10 (2025)</div>
                        <div className="flex gap-2 flex-wrap">
                          {report.reportData.owaspViolations.llm2025.map((code) => (
                            <Badge key={code} variant="secondary" className="font-mono">
                              {code}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {report.reportData.owaspViolations.agentic2026.length > 0 && (
                      <div className="p-4 flex items-start gap-4">
                        <div className="text-sm font-medium min-w-[180px]">Agentic AI Top 10 (2026)</div>
                        <div className="flex gap-2 flex-wrap">
                          {report.reportData.owaspViolations.agentic2026.map((code) => (
                            <Badge key={code} variant="secondary" className="font-mono">
                              {code}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {report.reportData.owaspViolations.web2025.length > 0 && (
                      <div className="p-4 flex items-start gap-4">
                        <div className="text-sm font-medium min-w-[180px]">Web Top 10 (2025)</div>
                        <div className="flex gap-2 flex-wrap">
                          {report.reportData.owaspViolations.web2025.map((code) => (
                            <Badge key={code} variant="secondary" className="font-mono">
                              {code}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Top Recommendations */}
              {report.reportData.topRecommendations.length > 0 && (
                <section>
                  <h3 className="text-lg font-semibold mb-3">Top Recommendations</h3>
                  <div className="border rounded-lg">
                    <ol className="divide-y">
                      {report.reportData.topRecommendations.map((rec, i) => (
                        <li key={i} className="p-4 flex gap-4">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center justify-center">
                            {i + 1}
                          </span>
                          <span className="text-sm">{rec}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </section>
              )}

              {/* Authorized Access */}
              {(report.reportData.authorizedAccess.approvedPlans.length > 0 ||
                report.reportData.authorizedAccess.apiTokens.length > 0) && (
                <section>
                  <h3 className="text-lg font-semibold mb-3">Authorized Access</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Approved autonomous capabilities configured in your organization
                  </p>
                  <div className="border rounded-lg divide-y">
                    {report.reportData.authorizedAccess.approvedPlans.length > 0 && (
                      <div className="p-4">
                        <div className="text-sm font-medium mb-3">Approved Execution Plans</div>
                        <div className="space-y-2">
                          {report.reportData.authorizedAccess.approvedPlans.map((plan, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-3 w-3 text-green-500" />
                              <span>{plan.skillName}</span>
                              <span className="text-muted-foreground text-xs">
                                (approved {new Date(plan.approvedAt).toLocaleDateString()})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {report.reportData.authorizedAccess.apiTokens.length > 0 && (
                      <div className="p-4">
                        <div className="text-sm font-medium mb-3">API Access Tokens</div>
                        <div className="space-y-2">
                          {report.reportData.authorizedAccess.apiTokens.map((token, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <span>{token.agentName}:</span>
                              {token.hasApiKey && (
                                <Badge variant="outline" className="text-xs">
                                  API Key
                                </Badge>
                              )}
                              {token.hasWebhook && (
                                <Badge variant="outline" className="text-xs">
                                  Webhook
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </TabsContent>

            {/* Findings Tab */}
            <TabsContent value="findings" className="space-y-6 mt-6">
              {/* Status Summary */}
              <div className="flex gap-4 text-sm">
                <span className="text-muted-foreground">
                  <span className="font-medium text-red-600">{findingsByStatus.open}</span> open
                </span>
                <span className="text-muted-foreground">
                  <span className="font-medium text-amber-600">{findingsByStatus.acknowledged}</span>{' '}
                  acknowledged
                </span>
                <span className="text-muted-foreground">
                  <span className="font-medium text-green-600">{findingsByStatus.mitigated}</span>{' '}
                  mitigated
                </span>
              </div>

              {findings.length === 0 ? (
                <div className="border rounded-lg p-8 text-center">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
                  <p className="text-lg font-medium">No security issues found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your organization passed all security checks
                  </p>
                </div>
              ) : (
                <>
                  {/* Findings by Resource Type */}
                  {(['agent', 'skill', 'automation', 'delegation'] as ResourceType[]).map((resourceType) => {
                    const resourceFindings = findingsByResource[resourceType];
                    if (resourceFindings.length === 0) return null;

                    return (
                      <section key={resourceType}>
                        <h3 className="text-md font-semibold mb-3 flex items-center gap-2">
                          {resourceTypeIcons[resourceType]}
                          {resourceTypeLabels[resourceType]}
                          <Badge variant="outline" className="ml-1">
                            {resourceFindings.length}
                          </Badge>
                        </h3>
                        <FindingsTable
                          findings={resourceFindings}
                          expandedRows={expandedRows}
                          toggleRow={toggleRow}
                          handleUpdateStatus={handleUpdateStatus}
                          isPending={isPending}
                        />
                      </section>
                    );
                  })}
                </>
              )}
            </TabsContent>

            {/* Validated Tab */}
            <TabsContent value="validated" className="space-y-6 mt-6">
              {report.reportData.strengths.length === 0 ? (
                <div className="border rounded-lg p-8 text-center text-muted-foreground">
                  No validated checks to display
                </div>
              ) : (
                Object.entries(strengthsByCategory).map(([category, strengths]) => (
                  <section key={category}>
                    <h3 className="text-md font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      {formatCategoryName(category)}
                      <Badge variant="outline" className="text-green-600 ml-1">
                        {strengths.length} passed
                      </Badge>
                    </h3>
                    <div className="border rounded-lg divide-y">
                      {strengths.map((strength, i) => (
                        <div key={i} className="p-4">
                          <div className="flex items-start gap-3">
                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <div className="font-medium text-sm">{strength.title}</div>
                              <div className="text-sm text-muted-foreground mt-0.5">
                                {strength.description}
                              </div>
                              {strength.resourceId && (
                                <div className="text-xs text-muted-foreground mt-2">
                                  Resource: {strength.resourceType} #{strength.resourceId}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function StatCard({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  valueClass?: string;
}) {
  return (
    <div className="p-4 border rounded-lg bg-card">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        {icon}
        {label}
      </div>
      <div className={cn('text-2xl font-bold', valueClass)}>{value}</div>
    </div>
  );
}

function FindingsTable({
  findings,
  expandedRows,
  toggleRow,
  handleUpdateStatus,
  isPending,
}: {
  findings: SecurityFinding[];
  expandedRows: Set<number>;
  toggleRow: (id: number) => void;
  handleUpdateStatus: (id: number, status: FindingStatus) => void;
  isPending: boolean;
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-8"></TableHead>
            <TableHead className="w-24">Severity</TableHead>
            <TableHead className="w-28">Status</TableHead>
            <TableHead>Finding</TableHead>
            <TableHead className="w-40">Resource</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {findings.map((finding) => (
            <Collapsible key={finding.id} asChild open={expandedRows.has(finding.id)}>
              <>
                <TableRow
                  className={cn(
                    'cursor-pointer hover:bg-muted/50',
                    expandedRows.has(finding.id) && 'bg-muted/30'
                  )}
                >
                  <TableCell className="p-2">
                    <CollapsibleTrigger asChild onClick={() => toggleRow(finding.id)}>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        {expandedRows.has(finding.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn('text-xs', riskBadgeStyles[finding.riskLevel])}>
                      {finding.riskLevel}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn('text-xs', statusBadgeStyles[finding.status])}
                    >
                      {statusLabels[finding.status]}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className="font-medium cursor-pointer"
                    onClick={() => toggleRow(finding.id)}
                  >
                    {finding.findingData.title}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {finding.findingData.resource.name}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {finding.status === 'open' && (
                          <>
                            <DropdownMenuItem
                              onClick={() => handleUpdateStatus(finding.id, 'acknowledged')}
                              disabled={isPending}
                            >
                              Acknowledge
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleUpdateStatus(finding.id, 'mitigated')}
                              disabled={isPending}
                            >
                              Mark as Mitigated
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleUpdateStatus(finding.id, 'false_positive')}
                              disabled={isPending}
                            >
                              Mark as False Positive
                            </DropdownMenuItem>
                          </>
                        )}
                        {finding.status !== 'open' && (
                          <DropdownMenuItem
                            onClick={() => handleUpdateStatus(finding.id, 'open')}
                            disabled={isPending}
                          >
                            Reopen Finding
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                <CollapsibleContent asChild>
                  <TableRow className="bg-muted/20 hover:bg-muted/20">
                    <TableCell colSpan={6} className="p-0">
                      <div className="px-6 py-4 space-y-4">
                        <p className="text-sm text-muted-foreground">
                          {finding.findingData.description}
                        </p>

                        <div className="bg-background border rounded-md p-4">
                          <div className="text-sm font-medium mb-2">Recommendation</div>
                          <p className="text-sm">{finding.findingData.remediation.recommendation}</p>
                          {finding.findingData.remediation.steps &&
                            finding.findingData.remediation.steps.length > 0 && (
                              <ol className="list-decimal list-inside mt-3 space-y-1 text-sm text-muted-foreground">
                                {finding.findingData.remediation.steps.map((step, i) => (
                                  <li key={i}>{step}</li>
                                ))}
                              </ol>
                            )}
                        </div>

                        {finding.findingData.owaspRefs.length > 0 && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <ExternalLink className="h-3 w-3" />
                            <span>References:</span>
                            {finding.findingData.owaspRefs.map((ref, i) => (
                              <Badge key={i} variant="outline" className="text-xs font-mono">
                                {ref.code}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                </CollapsibleContent>
              </>
            </Collapsible>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function formatCategoryName(category: string): string {
  // Convert snake_case or camelCase to Title Case
  return category
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}
