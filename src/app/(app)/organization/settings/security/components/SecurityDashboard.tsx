'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  generateSecurityReport,
  listSecurityReports,
  getSecurityReport,
  updateFindingStatus,
} from '@/app/actions/security';
import type { SecurityReport, SecurityFinding, FindingStatus, RiskLevel } from '@/ddd/domain/security/types';
import { Shield, AlertTriangle, CheckCircle, Loader2, RefreshCw, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const gradeColors: Record<string, string> = {
  A: 'bg-green-500',
  B: 'bg-green-400',
  C: 'bg-yellow-500',
  D: 'bg-orange-500',
  F: 'bg-red-500',
};

const riskColors: Record<RiskLevel, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-blue-400 text-white',
  info: 'bg-gray-400 text-white',
};

const statusColors: Record<string, string> = {
  open: 'bg-red-100 text-red-800 border-red-200',
  acknowledged: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  mitigated: 'bg-green-100 text-green-800 border-green-200',
  false_positive: 'bg-gray-100 text-gray-800 border-gray-200',
};

export function SecurityDashboard() {
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [findings, setFindings] = useState<SecurityFinding[]>([]);
  const [reports, setReports] = useState<SecurityReport[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [expandedFindings, setExpandedFindings] = useState<Set<number>>(new Set());

  // Load existing reports on mount
  useEffect(() => {
    startTransition(async () => {
      const result = await listSecurityReports(10);
      if (result.success && result.data) {
        setReports(result.data);
        // Load the most recent report if exists
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
        // Fetch full report with findings
        const fullResult = await getSecurityReport(result.data.id);
        if (fullResult.success && fullResult.data) {
          setReport(fullResult.data.report);
          setFindings(fullResult.data.findings);
          // Refresh reports list
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

  const toggleFindingExpanded = (findingId: number) => {
    setExpandedFindings((prev) => {
      const next = new Set(prev);
      if (next.has(findingId)) {
        next.delete(findingId);
      } else {
        next.add(findingId);
      }
      return next;
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" /> Security Analysis
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Analyze your agents, skills, and automations for security vulnerabilities
          </p>
        </div>
        <Button onClick={handleGenerateReport} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          {isPending ? 'Analyzing...' : 'Run Security Analysis'}
        </Button>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-4 rounded border border-red-200">{error}</div>}

      {!report && !isPending && (
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Security Report</h3>
            <p className="text-muted-foreground mb-4">
              Run a security analysis to identify vulnerabilities in your organization's configuration.
            </p>
            <Button onClick={handleGenerateReport}>Run First Analysis</Button>
          </CardContent>
        </Card>
      )}

      {report && (
        <>
          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle>Security Score</CardTitle>
              <CardDescription>
                Generated {new Date(report.generatedAt).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-6">
              <div
                className={cn(
                  gradeColors[report.reportData.riskGrade],
                  'text-white text-4xl font-bold w-20 h-20 rounded-full flex items-center justify-center shadow-lg'
                )}
              >
                {report.reportData.riskGrade}
              </div>
              <div className="flex-1">
                <div className="text-3xl font-bold">{report.reportData.overallScore}/100</div>
                <div className="text-muted-foreground flex gap-4 mt-1 flex-wrap">
                  {report.reportData.findingCounts.critical > 0 && (
                    <span className="text-red-600 font-medium">
                      {report.reportData.findingCounts.critical} critical
                    </span>
                  )}
                  {report.reportData.findingCounts.high > 0 && (
                    <span className="text-orange-600 font-medium">
                      {report.reportData.findingCounts.high} high
                    </span>
                  )}
                  {report.reportData.findingCounts.medium > 0 && (
                    <span className="text-yellow-600 font-medium">
                      {report.reportData.findingCounts.medium} medium
                    </span>
                  )}
                  {report.reportData.findingCounts.low > 0 && (
                    <span className="text-blue-600">{report.reportData.findingCounts.low} low</span>
                  )}
                  {report.reportData.findingCounts.info > 0 && (
                    <span className="text-gray-600">{report.reportData.findingCounts.info} info</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* OWASP Violations */}
          {(report.reportData.owaspViolations.llm2025.length > 0 ||
            report.reportData.owaspViolations.agentic2026.length > 0 ||
            report.reportData.owaspViolations.web2025.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  OWASP Violations Detected
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.reportData.owaspViolations.llm2025.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">LLM Top 10 (2025)</h4>
                    <div className="flex gap-2 flex-wrap">
                      {report.reportData.owaspViolations.llm2025.map((code) => (
                        <Badge key={code} variant="outline" className="bg-purple-50">
                          {code}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {report.reportData.owaspViolations.agentic2026.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">Agentic AI Top 10 (2026)</h4>
                    <div className="flex gap-2 flex-wrap">
                      {report.reportData.owaspViolations.agentic2026.map((code) => (
                        <Badge key={code} variant="outline" className="bg-blue-50">
                          {code}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {report.reportData.owaspViolations.web2025.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">Web Top 10 (2025)</h4>
                    <div className="flex gap-2 flex-wrap">
                      {report.reportData.owaspViolations.web2025.map((code) => (
                        <Badge key={code} variant="outline" className="bg-green-50">
                          {code}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Security Strengths */}
          {report.reportData.strengths.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Security Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {report.reportData.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium">{s.title}</div>
                        <div className="text-sm text-muted-foreground">{s.description}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Authorized Access */}
          {(report.reportData.authorizedAccess.approvedPlans.length > 0 ||
            report.reportData.authorizedAccess.apiTokens.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-500" />
                  Authorized Access
                </CardTitle>
                <CardDescription>Approved autonomous capabilities in your organization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {report.reportData.authorizedAccess.approvedPlans.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Approved Execution Plans</h4>
                    <div className="space-y-1">
                      {report.reportData.authorizedAccess.approvedPlans.map((p, i) => (
                        <div key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          <span>{p.skillName}</span>
                          <span className="text-xs">
                            (approved {new Date(p.approvedAt).toLocaleDateString()})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {report.reportData.authorizedAccess.apiTokens.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">API Access</h4>
                    <div className="space-y-1">
                      {report.reportData.authorizedAccess.apiTokens.map((t, i) => (
                        <div key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                          <span>{t.agentName}:</span>
                          {t.hasApiKey && <Badge variant="outline">API Key</Badge>}
                          {t.hasWebhook && <Badge variant="outline">Webhook</Badge>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Findings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Security Findings ({findings.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {findings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                  <p>No security issues found!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {findings.map((f) => (
                    <div key={f.id} className="border rounded-lg overflow-hidden">
                      <div
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleFindingExpanded(f.id)}
                      >
                        <div className="flex items-center gap-3">
                          <Badge className={cn('text-xs', riskColors[f.riskLevel])}>{f.riskLevel}</Badge>
                          <Badge variant="outline" className={cn('text-xs', statusColors[f.status])}>
                            {f.status.replace('_', ' ')}
                          </Badge>
                          <span className="font-medium">{f.findingData.title}</span>
                        </div>
                        {expandedFindings.has(f.id) ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>

                      {expandedFindings.has(f.id) && (
                        <div className="px-4 pb-4 pt-0 space-y-3 border-t">
                          <p className="text-sm text-muted-foreground">{f.findingData.description}</p>

                          <div className="bg-muted p-3 rounded text-sm">
                            <strong>Recommendation:</strong> {f.findingData.remediation.recommendation}
                            {f.findingData.remediation.steps && f.findingData.remediation.steps.length > 0 && (
                              <ol className="list-decimal list-inside mt-2 space-y-1">
                                {f.findingData.remediation.steps.map((step, i) => (
                                  <li key={i}>{step}</li>
                                ))}
                              </ol>
                            )}
                          </div>

                          {f.findingData.owaspRefs.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              <strong>OWASP:</strong>{' '}
                              {f.findingData.owaspRefs.map((r) => `${r.code} (${r.name})`).join(', ')}
                            </div>
                          )}

                          <div className="text-xs text-muted-foreground">
                            <strong>Resource:</strong> {f.findingData.resource.type} - {f.findingData.resource.name}
                          </div>

                          {f.status === 'open' && (
                            <div className="flex gap-2 pt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateStatus(f.id, 'acknowledged');
                                }}
                                disabled={isPending}
                              >
                                Acknowledge
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateStatus(f.id, 'mitigated');
                                }}
                                disabled={isPending}
                              >
                                Mark Mitigated
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateStatus(f.id, 'false_positive');
                                }}
                                disabled={isPending}
                              >
                                False Positive
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recommendations */}
          {report.reportData.topRecommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal list-inside space-y-2">
                  {report.reportData.topRecommendations.map((rec, i) => (
                    <li key={i} className="text-sm">
                      {rec}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
