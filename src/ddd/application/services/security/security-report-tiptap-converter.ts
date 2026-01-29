/**
 * Security Report TipTap Converter
 *
 * Converts security reports and findings to TipTap JSON format for rich text
 * display and document storage.
 *
 * AIDEV-NOTE: This service converts SecurityReport + SecurityFinding[] to
 * TipTap document format that can be stored in document fields or displayed
 * in the TipTap editor.
 */

import type {
  SecurityReport,
  SecurityFinding,
  RiskLevel,
} from '@/ddd/domain/security/types';

// TipTap JSON types
interface TipTapTextNode {
  type: 'text';
  text: string;
  marks?: Array<{
    type: string;
    attrs?: Record<string, unknown>;
  }>;
}

interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Array<TipTapNode | TipTapTextNode>;
}

interface TipTapDocument {
  type: 'doc';
  content: TipTapNode[];
}

const riskLevelOrder: RiskLevel[] = ['critical', 'high', 'medium', 'low', 'info'];

/**
 * Convert a security report with findings to TipTap document format
 */
export function convertSecurityReportToTipTap(
  report: SecurityReport,
  findings: SecurityFinding[]
): TipTapDocument {
  const content: TipTapNode[] = [];

  // Title
  content.push(heading(1, 'Security Report'));

  // Subtitle with date
  content.push(
    paragraph([
      text('Generated on '),
      text(formatDate(report.generatedAt), ['bold']),
    ])
  );

  // Horizontal rule
  content.push({ type: 'horizontalRule' });

  // Executive Summary
  content.push(heading(2, 'Executive Summary'));

  // Grade and Score
  content.push(
    paragraph([
      text('Security Grade: '),
      text(report.reportData.riskGrade, ['bold']),
      text(' ('),
      text(`${report.reportData.overallScore}/100`, ['bold']),
      text(')'),
    ])
  );

  // Finding counts
  const counts = report.reportData.findingCounts;
  const countLines = [
    counts.critical > 0 ? `${counts.critical} critical` : null,
    counts.high > 0 ? `${counts.high} high` : null,
    counts.medium > 0 ? `${counts.medium} medium` : null,
    counts.low > 0 ? `${counts.low} low` : null,
    counts.info > 0 ? `${counts.info} informational` : null,
  ].filter(Boolean);

  if (countLines.length > 0) {
    content.push(
      paragraph([
        text('Findings: '),
        text(countLines.join(', ')),
      ])
    );
  } else {
    content.push(paragraph([text('No security issues found.')]));
  }

  // OWASP Violations
  const owaspViolations = report.reportData.owaspViolations;
  const hasOwaspViolations =
    owaspViolations.llm2025.length > 0 ||
    owaspViolations.agentic2026.length > 0 ||
    owaspViolations.web2025.length > 0;

  if (hasOwaspViolations) {
    content.push(heading(2, 'OWASP Compliance Issues'));

    if (owaspViolations.llm2025.length > 0) {
      content.push(
        paragraph([
          text('LLM Top 10 (2025): ', ['bold']),
          text(owaspViolations.llm2025.join(', '), ['code']),
        ])
      );
    }
    if (owaspViolations.agentic2026.length > 0) {
      content.push(
        paragraph([
          text('Agentic AI Top 10 (2026): ', ['bold']),
          text(owaspViolations.agentic2026.join(', '), ['code']),
        ])
      );
    }
    if (owaspViolations.web2025.length > 0) {
      content.push(
        paragraph([
          text('Web Top 10 (2025): ', ['bold']),
          text(owaspViolations.web2025.join(', '), ['code']),
        ])
      );
    }
  }

  // Agent Risk Profiles
  if (report.reportData.agentProfiles.length > 0) {
    content.push(heading(2, 'Agent Risk Profiles'));

    const tableRows = report.reportData.agentProfiles.map((agent) => ({
      type: 'tableRow',
      content: [
        tableCell(agent.agentName),
        tableCell(`${agent.riskScore}`),
        tableCell(`${agent.findingCount}`),
        tableCell(agent.findingCount === 0 ? 'Passed' : 'Has Issues'),
      ],
    }));

    content.push({
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            tableHeader('Agent'),
            tableHeader('Risk Score'),
            tableHeader('Findings'),
            tableHeader('Status'),
          ],
        },
        ...tableRows,
      ],
    });
  }

  // Security Findings
  if (findings.length > 0) {
    content.push(heading(2, 'Security Findings'));

    // Sort by severity
    const sortedFindings = [...findings].sort(
      (a, b) => riskLevelOrder.indexOf(a.riskLevel) - riskLevelOrder.indexOf(b.riskLevel)
    );

    // Group by resource type
    const groupedFindings: Record<string, SecurityFinding[]> = {};
    sortedFindings.forEach((f) => {
      const type = f.findingData.resource.type;
      if (!groupedFindings[type]) {
        groupedFindings[type] = [];
      }
      groupedFindings[type].push(f);
    });

    for (const [resourceType, resourceFindings] of Object.entries(groupedFindings)) {
      content.push(heading(3, capitalizeFirst(resourceType) + 's'));

      resourceFindings.forEach((finding, index) => {
        // Finding title with severity
        content.push(
          paragraph([
            text(`${index + 1}. `, ['bold']),
            text(`[${finding.riskLevel.toUpperCase()}] `, ['bold', 'code']),
            text(finding.findingData.title, ['bold']),
          ])
        );

        // Description
        content.push(paragraph([text(finding.findingData.description)]));

        // Resource
        content.push(
          paragraph([
            text('Resource: ', ['italic']),
            text(`${finding.findingData.resource.name} (${finding.findingData.resource.type})`),
          ])
        );

        // Status
        content.push(
          paragraph([
            text('Status: ', ['italic']),
            text(finding.status.replace('_', ' ')),
          ])
        );

        // Recommendation
        content.push(
          blockquote([
            paragraph([
              text('Recommendation: ', ['bold']),
              text(finding.findingData.remediation.recommendation),
            ]),
          ])
        );

        // Steps if any
        if (finding.findingData.remediation.steps && finding.findingData.remediation.steps.length > 0) {
          content.push({
            type: 'orderedList',
            content: finding.findingData.remediation.steps.map((step) => ({
              type: 'listItem',
              content: [paragraph([text(step)])],
            })),
          });
        }

        // OWASP references
        if (finding.findingData.owaspRefs.length > 0) {
          const refs = finding.findingData.owaspRefs
            .map((ref) => `${ref.code} (${ref.name})`)
            .join(', ');
          content.push(
            paragraph([
              text('OWASP References: ', ['italic']),
              text(refs, ['code']),
            ])
          );
        }

        // Add space between findings
        if (index < resourceFindings.length - 1) {
          content.push({ type: 'horizontalRule' });
        }
      });
    }
  }

  // Security Strengths
  if (report.reportData.strengths.length > 0) {
    content.push(heading(2, 'Security Strengths'));

    report.reportData.strengths.forEach((strength) => {
      content.push(
        paragraph([
          text('✓ ', ['bold']),
          text(strength.title, ['bold']),
        ])
      );
      content.push(paragraph([text(strength.description)]));
    });
  }

  // Top Recommendations
  if (report.reportData.topRecommendations.length > 0) {
    content.push(heading(2, 'Top Recommendations'));

    content.push({
      type: 'orderedList',
      content: report.reportData.topRecommendations.map((rec) => ({
        type: 'listItem',
        content: [paragraph([text(rec)])],
      })),
    });
  }

  // Authorized Access
  const auth = report.reportData.authorizedAccess;
  if (auth.approvedPlans.length > 0 || auth.apiTokens.length > 0) {
    content.push(heading(2, 'Authorized Access'));

    if (auth.approvedPlans.length > 0) {
      content.push(heading(3, 'Approved Execution Plans'));
      content.push({
        type: 'bulletList',
        content: auth.approvedPlans.map((plan) => ({
          type: 'listItem',
          content: [
            paragraph([
              text(plan.skillName),
              text(` (approved ${formatDateShort(plan.approvedAt)})`, ['italic']),
            ]),
          ],
        })),
      });
    }

    if (auth.apiTokens.length > 0) {
      content.push(heading(3, 'API Access Tokens'));
      content.push({
        type: 'bulletList',
        content: auth.apiTokens.map((token) => ({
          type: 'listItem',
          content: [
            paragraph([
              text(token.agentName + ': '),
              text(
                [
                  token.hasApiKey ? 'API Key' : null,
                  token.hasWebhook ? 'Webhook' : null,
                ]
                  .filter(Boolean)
                  .join(', ') || 'None'
              ),
            ]),
          ],
        })),
      });
    }
  }

  // Footer
  content.push({ type: 'horizontalRule' });
  content.push(
    paragraph([
      text('This report was automatically generated by the Security Analysis system.', ['italic']),
    ])
  );

  return {
    type: 'doc',
    content,
  };
}

// Helper functions for creating TipTap nodes

function heading(level: number, textContent: string): TipTapNode {
  return {
    type: 'heading',
    attrs: { level },
    content: [{ type: 'text', text: textContent }],
  };
}

function paragraph(content: TipTapTextNode[]): TipTapNode {
  return {
    type: 'paragraph',
    content,
  };
}

function text(content: string, marks?: string[]): TipTapTextNode {
  const node: TipTapTextNode = {
    type: 'text',
    text: content,
  };
  if (marks && marks.length > 0) {
    node.marks = marks.map((mark) => ({ type: mark }));
  }
  return node;
}

function blockquote(content: TipTapNode[]): TipTapNode {
  return {
    type: 'blockquote',
    content,
  };
}

function tableCell(content: string): TipTapNode {
  return {
    type: 'tableCell',
    content: [paragraph([text(content)])],
  };
}

function tableHeader(content: string): TipTapNode {
  return {
    type: 'tableHeader',
    content: [paragraph([text(content, ['bold'])])],
  };
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateShort(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
