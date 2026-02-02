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
  Info,
  Circle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const gradeColors: Record<string, string> = {
  A: 'bg-success text-success-foreground',
  B: 'bg-success/80 text-success-foreground',
  C: 'bg-warning text-warning-foreground',
  D: 'bg-warning/80 text-warning-foreground',
  F: 'bg-destructive text-destructive-foreground',
};

const riskLevelOrder: RiskLevel[] = ['critical', 'high', 'medium', 'low', 'info'];

const riskBadgeStyles: Record<RiskLevel, string> = {
  critical: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  high: 'bg-warning text-warning-foreground hover:bg-warning/90',
  medium: 'bg-warning/80 text-warning-foreground hover:bg-warning/70',
  low: 'bg-primary text-primary-foreground hover:bg-primary/90',
  info: 'bg-muted text-muted-foreground hover:bg-muted/80',
};

const statusBadgeStyles: Record<FindingStatus, string> = {
  open: 'bg-destructive/10 text-destructive border-destructive/20',
  acknowledged: 'bg-warning/10 text-warning border-warning/20',
  mitigated: 'bg-success/10 text-success border-success/20',
  false_positive: 'bg-muted text-muted-foreground border-border',
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

  // Derive active OWASP violations from open findings only
  const activeOwaspViolations = useMemo(() => {
    const result = { llm2025: new Set<string>(), agentic2026: new Set<string>(), web2025: new Set<string>() };
    findings.filter((f) => f.status === 'open').forEach((f) => {
      f.findingData.owaspRefs.forEach((ref) => {
        if (ref.category === 'LLM_2025') result.llm2025.add(ref.code);
        else if (ref.category === 'AGENTIC_2026') result.agentic2026.add(ref.code);
        else if (ref.category === 'WEB_2025') result.web2025.add(ref.code);
      });
    });
    return {
      llm2025: Array.from(result.llm2025),
      agentic2026: Array.from(result.agentic2026),
      web2025: Array.from(result.web2025),
    };
  }, [findings]);

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
    <div className="max-w-6xl mx-auto py-4 px-4 space-y-4">
      {/* Report Header */}
      <header className="border-b pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Security Report</h1>
            {report && (
              <p className="text-muted-foreground text-sm mt-0.5">
                Generated on {formatDate(report.generatedAt)}
              </p>
            )}
          </div>
          <Button onClick={handleGenerateReport} disabled={isPending} variant="outline" size="sm">
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
        <div className="bg-destructive/10 text-destructive p-3 rounded-lg border border-destructive/20 text-sm">
          {error}
        </div>
      )}

      {report && (
        <>
          {/* Introduction */}
          <p className="text-sm text-muted-foreground">
            This report analyzes your agents, skills, automations, and access configurations
            for common security risks including prompt injection, excessive permissions, and
            unapproved triggers — mapped to OWASP LLM, Agentic AI, and Web Top 10 standards.
          </p>

          {/* Score Summary Bar */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="col-span-2 flex items-center gap-3 p-3 border rounded-lg bg-card">
              <div
                className={cn(
                  gradeColors[report.reportData.riskGrade],
                  'text-2xl font-bold w-12 h-12 rounded-full flex items-center justify-center shadow-sm'
                )}
              >
                {report.reportData.riskGrade}
              </div>
              <div>
                <div className="text-xl font-bold">{report.reportData.overallScore}/100</div>
                <div className="text-xs text-muted-foreground">Security Score</div>
              </div>
            </div>
            <StatCard
              icon={<XCircle className="h-3.5 w-3.5 text-red-500" />}
              label="Critical"
              value={report.reportData.findingCounts.critical}
              valueClass="text-red-600"
            />
            <StatCard
              icon={<AlertCircle className="h-3.5 w-3.5 text-orange-500" />}
              label="High"
              value={report.reportData.findingCounts.high}
              valueClass="text-orange-600"
            />
            <StatCard
              icon={<AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />}
              label="Medium"
              value={report.reportData.findingCounts.medium}
              valueClass="text-yellow-600"
            />
            <StatCard
              icon={<CheckCircle className="h-3.5 w-3.5 text-green-500" />}
              label="Validated"
              value={report.reportData.strengths.length}
              valueClass="text-green-600"
            />
          </div>

          {/* Unified Report Body */}
          <div className="border rounded-lg divide-y">
            {/* Agent Risk Profiles */}
            {report.reportData.agentProfiles.length > 0 && (
              <div className="p-3">
                <div className="text-sm font-medium mb-2">Agent Risk Profiles</div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="h-8 text-xs">Agent</TableHead>
                      <TableHead className="h-8 text-xs w-24 text-center">Score</TableHead>
                      <TableHead className="h-8 text-xs w-24 text-center">Findings</TableHead>
                      <TableHead className="h-8 text-xs w-20 text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.reportData.agentProfiles.map((agent) => (
                      <TableRow key={agent.agentId}>
                        <TableCell className="py-2 font-medium text-sm">
                          <div className="flex items-center gap-2">
                            <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                            {agent.agentName}
                          </div>
                        </TableCell>
                        <TableCell className="py-2 text-center">
                          <span
                            className={cn(
                              'font-mono text-sm font-medium',
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
                        <TableCell className="py-2 text-center">
                          {agent.findingCount > 0 ? (
                            <Badge variant="outline" className="text-xs text-red-600 border-red-200">
                              {agent.findingCount}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2 text-center">
                          {agent.findingCount === 0 ? (
                            <CheckCircle className="h-3.5 w-3.5 text-green-500 mx-auto" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mx-auto" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* OWASP Compliance — derived from open findings only */}
            {(activeOwaspViolations.llm2025.length > 0 ||
              activeOwaspViolations.agentic2026.length > 0 ||
              activeOwaspViolations.web2025.length > 0) && (
              <div className="p-3">
                <div className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  OWASP Compliance Issues
                </div>
                <div className="space-y-1.5">
                  {activeOwaspViolations.llm2025.length > 0 && (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground min-w-[150px]">LLM Top 10 (2025)</span>
                      <div className="flex gap-1.5 flex-wrap">
                        {activeOwaspViolations.llm2025.map((code) => (
                          <Badge key={code} variant="secondary" className="font-mono text-xs">
                            {code}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {activeOwaspViolations.agentic2026.length > 0 && (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground min-w-[150px]">Agentic AI Top 10 (2026)</span>
                      <div className="flex gap-1.5 flex-wrap">
                        {activeOwaspViolations.agentic2026.map((code) => (
                          <Badge key={code} variant="secondary" className="font-mono text-xs">
                            {code}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {activeOwaspViolations.web2025.length > 0 && (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground min-w-[150px]">Web Top 10 (2025)</span>
                      <div className="flex gap-1.5 flex-wrap">
                        {activeOwaspViolations.web2025.map((code) => (
                          <Badge key={code} variant="secondary" className="font-mono text-xs">
                            {code}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {report.reportData.topRecommendations.length > 0 && (
              <div className="p-3">
                <div className="text-sm font-medium mb-2">Recommendations</div>
                <ul className="space-y-1">
                  {report.reportData.topRecommendations.map((rec, i) => (
                    <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="text-foreground shrink-0">&bull;</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Authorized Access */}
            {(report.reportData.authorizedAccess.approvedPlans.length > 0 ||
              report.reportData.authorizedAccess.apiTokens.length > 0) && (
              <div className="p-3">
                <div className="text-sm font-medium mb-2">Authorized Access</div>
                <div className="space-y-2">
                  {report.reportData.authorizedAccess.approvedPlans.length > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Approved Execution Plans</div>
                      <div className="space-y-0.5">
                        {report.reportData.authorizedAccess.approvedPlans.map((plan, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-sm">
                            <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
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
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">API Access Tokens</div>
                      <div className="space-y-0.5">
                        {report.reportData.authorizedAccess.apiTokens.map((token, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-sm">
                            <span>{token.agentName}:</span>
                            {token.hasApiKey && (
                              <Badge variant="outline" className="text-xs py-0">
                                API Key
                              </Badge>
                            )}
                            {token.hasWebhook && (
                              <Badge variant="outline" className="text-xs py-0">
                                Webhook
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Issues */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              Issues
              {findingsByStatus.open > 0 && (
                <Badge variant="destructive" className="text-xs px-1.5 py-0">
                  {findingsByStatus.open}
                </Badge>
              )}
            </h3>

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
              <div className="border rounded-lg p-6 text-center">
                <CheckCircle className="h-10 w-10 mx-auto text-green-500 mb-2" />
                <p className="text-sm font-medium">No security issues found</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your organization passed all security checks
                </p>
              </div>
            ) : (
              <>
                {(['agent', 'skill', 'automation', 'delegation'] as ResourceType[]).map((resourceType) => {
                  const resourceFindings = findingsByResource[resourceType];
                  if (resourceFindings.length === 0) return null;

                  return (
                    <div key={resourceType}>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        {resourceTypeIcons[resourceType]}
                        {resourceTypeLabels[resourceType]}
                        <Badge variant="outline" className="ml-1 text-xs">
                          {resourceFindings.length}
                        </Badge>
                      </h4>
                      <FindingsTable
                        findings={resourceFindings}
                        expandedRows={expandedRows}
                        toggleRow={toggleRow}
                        handleUpdateStatus={handleUpdateStatus}
                        isPending={isPending}
                      />
                    </div>
                  );
                })}
              </>
            )}
          </section>

          {/* Validated */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              Validated
              <Badge variant="outline" className="text-xs px-1.5 py-0 text-green-600">
                {report.reportData.strengths.length}
              </Badge>
            </h3>

            {report.reportData.strengths.length === 0 ? (
              <div className="border rounded-lg p-6 text-center text-muted-foreground text-sm">
                No validated checks to display
              </div>
            ) : (
              Object.entries(strengthsByCategory).map(([category, strengths]) => (
                <div key={category}>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                    {formatCategoryName(category)}
                    <Badge variant="outline" className="text-green-600 ml-1 text-xs">
                      {strengths.length} passed
                    </Badge>
                  </h4>
                  <div className="border rounded-lg divide-y">
                    {strengths.map((strength, i) => (
                      <div key={i} className="px-3 py-2">
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{strength.title}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {strength.description}
                            </div>
                            {strength.resourceId && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Resource: {strength.resourceType} #{strength.resourceId}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>
        </>
      )}

      {/* Analysis Coverage */}
      {report && <AnalysisCoverage />}

      {/* About This Report */}
      <div className="border rounded-lg p-3 bg-muted/20">
        <div className="flex items-start gap-2">
          <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-0.5">About this report</div>
            <p className="text-xs text-muted-foreground">
              This report is based on automated static analysis of your agent configurations and skill
              setups. It&apos;s a helpful starting point but doesn&apos;t replace a full security review.
              Some things like runtime behavior, network config, and third-party services aren&apos;t
              covered here — check the coverage section above for details on what&apos;s included.
            </p>
          </div>
        </div>
      </div>
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
    <div className="p-3 border rounded-lg bg-card">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-0.5">
        {icon}
        {label}
      </div>
      <div className={cn('text-xl font-bold', valueClass)}>{value}</div>
    </div>
  );
}

function AnalysisCoverage() {
  return (
    <div className="border rounded-lg p-3 bg-muted/10">
      <div className="text-sm font-medium mb-2">Analysis Coverage</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0.5">
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Automated Checks</div>
          <ul className="space-y-0.5">
            <CoverageItem checked label="Prompt injection (interpolation patterns)" />
            <CoverageItem checked label="Prompt injection (social engineering)" />
            <CoverageItem checked label="Database trigger indirect injection" />
            <CoverageItem checked label="Excessive tool permissions" />
            <CoverageItem checked label="Dangerous tool combinations" />
            <CoverageItem checked label="Unapproved automation triggers" />
            <CoverageItem checked label="Sensitive data in instructions" />
            <CoverageItem checked label="Missing input validation" />
          </ul>
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Requires Manual Review</div>
          <ul className="space-y-0.5">
            <CoverageItem label="Runtime behavior testing" />
            <CoverageItem label="Data exfiltration paths" />
            <CoverageItem label="Multi-agent collusion" />
            <CoverageItem label="Rate limiting / abuse protection" />
            <CoverageItem label="Network security" />
            <CoverageItem label="Auth token rotation" />
            <CoverageItem label="Output filtering / PII leakage" />
            <CoverageItem label="Model configuration review" />
          </ul>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
        Standards: OWASP LLM Top 10 (2025), OWASP Agentic AI Top 10 (2026), OWASP Web Top 10 (2025)
      </div>
    </div>
  );
}

function CoverageItem({ checked, label }: { checked?: boolean; label: string }) {
  return (
    <li className="flex items-center gap-1.5 text-xs">
      {checked ? (
        <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
      ) : (
        <Circle className="h-3 w-3 text-muted-foreground/50 shrink-0" />
      )}
      <span className={checked ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </li>
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
                      <div className="px-4 py-3 space-y-3">
                        <p className="text-sm text-muted-foreground">
                          {finding.findingData.description}
                        </p>

                        <div className="bg-background border rounded-md p-3">
                          <div className="text-sm font-medium mb-1">Recommendation</div>
                          <p className="text-sm">{finding.findingData.remediation.recommendation}</p>
                          {finding.findingData.remediation.steps &&
                            finding.findingData.remediation.steps.length > 0 && (
                              <ol className="list-decimal list-inside mt-2 space-y-0.5 text-sm text-muted-foreground">
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
  return category
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}
