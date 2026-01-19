'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Settings,
  Shield,
  CheckCircle,
  Key,
  Loader2,
  Copy,
  AlertTriangle,
  Globe,
} from 'lucide-react';
import {
  initiatePublication,
  approvePublication,
  publishAgent,
} from '@/app/actions/published-agents';
import type { SecurityReport } from '@/ddd/domain/security/types';

interface PublishAgentWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: number;
  agentName: string;
  onSuccess?: () => void;
}

type WizardStep = 'configure' | 'security' | 'approve' | 'credentials';

interface PublishFormData {
  slug: string;
  displayName: string;
  description: string;
  allowTaskMode: boolean;
  allowSkillMode: boolean;
  minSecurityGrade: 'A' | 'B' | 'C';
}

const STEPS: {
  key: WizardStep;
  title: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    key: 'configure',
    title: 'Configure',
    description: 'Publication settings',
    icon: <Settings className="w-4 h-4" />,
  },
  {
    key: 'security',
    title: 'Security',
    description: 'Review security scan',
    icon: <Shield className="w-4 h-4" />,
  },
  {
    key: 'approve',
    title: 'Approve',
    description: 'Confirm publication',
    icon: <CheckCircle className="w-4 h-4" />,
  },
  {
    key: 'credentials',
    title: 'Credentials',
    description: 'Get API key',
    icon: <Key className="w-4 h-4" />,
  },
];

const gradeColors: Record<string, string> = {
  A: 'bg-green-500 text-white',
  B: 'bg-green-400 text-white',
  C: 'bg-yellow-500 text-black',
  D: 'bg-orange-500 text-white',
  F: 'bg-red-500 text-white',
};

export function PublishAgentWizard({
  open,
  onOpenChange,
  agentId,
  agentName,
  onSuccess,
}: PublishAgentWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('configure');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  // Form data
  const [formData, setFormData] = useState<PublishFormData>({
    slug: '',
    displayName: '',
    description: '',
    allowTaskMode: true,
    allowSkillMode: true,
    minSecurityGrade: 'B',
  });

  // Publication state
  const [publishedAgentId, setPublishedAgentId] = useState<number | null>(null);
  const [securityReport, setSecurityReport] = useState<SecurityReport | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);

  // Initialize form data when wizard opens
  useEffect(() => {
    if (open) {
      setFormData({
        slug: agentName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        displayName: agentName,
        description: '',
        allowTaskMode: true,
        allowSkillMode: true,
        minSecurityGrade: 'B',
      });
      setCurrentStep('configure');
      setError('');
      setPublishedAgentId(null);
      setSecurityReport(null);
      setApiKey(null);
      setAcknowledged(false);
    }
  }, [open, agentName]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const getCurrentStepIndex = () => STEPS.findIndex((step) => step.key === currentStep);
  const progress = ((getCurrentStepIndex() + 1) / STEPS.length) * 100;

  const canProceedFromConfigure = () => {
    return (
      formData.slug.trim().length > 0 &&
      formData.displayName.trim().length > 0 &&
      /^[a-z0-9-]+$/.test(formData.slug)
    );
  };

  const canProceedFromSecurity = () => {
    if (!securityReport) return false;
    const reportData = securityReport.reportData as { riskGrade?: string; findingCounts?: { critical?: number } };
    // Can proceed if grade meets minimum and no critical findings
    const gradeOrder = ['A', 'B', 'C', 'D', 'F'];
    const reportGradeIndex = gradeOrder.indexOf(reportData.riskGrade || 'F');
    const minGradeIndex = gradeOrder.indexOf(formData.minSecurityGrade);
    return reportGradeIndex <= minGradeIndex && (reportData.findingCounts?.critical || 0) === 0;
  };

  const canProceedFromApprove = () => {
    return acknowledged;
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'configure':
        return canProceedFromConfigure();
      case 'security':
        return canProceedFromSecurity();
      case 'approve':
        return canProceedFromApprove();
      case 'credentials':
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!canProceed()) return;

    if (currentStep === 'configure') {
      // Initiate publication and run security scan
      startTransition(async () => {
        setError('');
        const result = await initiatePublication({
          agentId,
          slug: formData.slug.trim(),
          displayName: formData.displayName.trim(),
          description: formData.description.trim() || undefined,
          allowTaskMode: formData.allowTaskMode,
          allowSkillMode: formData.allowSkillMode,
          minSecurityGrade: formData.minSecurityGrade,
        });

        if (result.success && result.data) {
          setPublishedAgentId(result.data.publishedAgent.id);
          if (result.data.securityReport) {
            setSecurityReport(result.data.securityReport);
          }
          setCurrentStep('security');
        } else {
          setError(result.error || 'Failed to initiate publication');
        }
      });
    } else if (currentStep === 'security') {
      setCurrentStep('approve');
    } else if (currentStep === 'approve') {
      // Approve and publish
      startTransition(async () => {
        setError('');
        if (!publishedAgentId) {
          setError('No published agent ID');
          return;
        }

        // First approve
        const approveResult = await approvePublication(publishedAgentId);
        if (!approveResult.success) {
          setError(approveResult.error || 'Failed to approve publication');
          return;
        }

        // Then publish to get API key
        const publishResult = await publishAgent(publishedAgentId);
        if (publishResult.success && publishResult.data) {
          setApiKey(publishResult.data.apiKey);
          setCurrentStep('credentials');
        } else {
          setError(publishResult.error || 'Failed to publish agent');
        }
      });
    }
  };

  const handleBack = () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].key);
    }
  };

  const handleCopyApiKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'configure':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug *</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                  })
                }
                placeholder="my-agent"
              />
              <p className="text-xs text-muted-foreground">
                URL: /api/v1/published/<span className="font-mono">{formData.slug || 'slug'}</span>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name *</Label>
              <Input
                id="displayName"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="My Agent"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What does this agent do?"
                rows={3}
              />
            </div>

            <div className="space-y-4 pt-4 border-t">
              <Label className="text-base font-medium">Access Modes</Label>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="taskMode" className="font-normal">
                    Task Mode
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Natural language task execution
                  </p>
                </div>
                <Switch
                  id="taskMode"
                  checked={formData.allowTaskMode}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, allowTaskMode: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="skillMode" className="font-normal">
                    Skill Mode
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Direct skill invocation with typed inputs
                  </p>
                </div>
                <Switch
                  id="skillMode"
                  checked={formData.allowSkillMode}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, allowSkillMode: checked })
                  }
                />
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="minGrade">Minimum Security Grade</Label>
              <Select
                value={formData.minSecurityGrade}
                onValueChange={(value) =>
                  setFormData({ ...formData, minSecurityGrade: value as 'A' | 'B' | 'C' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A - Highest Security</SelectItem>
                  <SelectItem value="B">B - Standard Security</SelectItem>
                  <SelectItem value="C">C - Basic Security</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Agent must pass this security grade to be published
              </p>
            </div>
          </div>
        );

      case 'security':
        const reportData = securityReport?.reportData as {
          riskGrade?: string;
          riskScore?: number;
          findingCounts?: { critical?: number; high?: number; medium?: number; low?: number };
        } | undefined;

        if (!securityReport) {
          return (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Running security scan...</p>
            </div>
          );
        }

        const meetsGrade = canProceedFromSecurity();

        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="text-sm font-medium">Security Grade</p>
                <p className="text-xs text-muted-foreground">Required: {formData.minSecurityGrade}</p>
              </div>
              <Badge className={`text-lg px-3 py-1 ${gradeColors[reportData?.riskGrade || 'F']}`}>
                {reportData?.riskGrade || 'N/A'}
              </Badge>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div className="p-3 border rounded-lg text-center">
                <div className="text-2xl font-bold text-red-600">
                  {reportData?.findingCounts?.critical || 0}
                </div>
                <div className="text-xs text-muted-foreground">Critical</div>
              </div>
              <div className="p-3 border rounded-lg text-center">
                <div className="text-2xl font-bold text-orange-500">
                  {reportData?.findingCounts?.high || 0}
                </div>
                <div className="text-xs text-muted-foreground">High</div>
              </div>
              <div className="p-3 border rounded-lg text-center">
                <div className="text-2xl font-bold text-yellow-500">
                  {reportData?.findingCounts?.medium || 0}
                </div>
                <div className="text-xs text-muted-foreground">Medium</div>
              </div>
              <div className="p-3 border rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-500">
                  {reportData?.findingCounts?.low || 0}
                </div>
                <div className="text-xs text-muted-foreground">Low</div>
              </div>
            </div>

            {!meetsGrade && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800">Cannot proceed</p>
                    <p className="text-sm text-red-700">
                      {(reportData?.findingCounts?.critical || 0) > 0
                        ? 'Critical security findings must be resolved before publication.'
                        : `Security grade ${reportData?.riskGrade} does not meet minimum requirement of ${formData.minSecurityGrade}.`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {meetsGrade && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-800">Security requirements met</p>
                    <p className="text-sm text-green-700">
                      This agent passes the minimum security requirements.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'approve':
        return (
          <div className="space-y-6">
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Publication Summary</span>
              </div>
              <div className="space-y-2 pl-6 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Slug:</span>
                  <span className="font-mono">{formData.slug}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Display Name:</span>
                  <span>{formData.displayName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Task Mode:</span>
                  <Badge variant={formData.allowTaskMode ? 'default' : 'secondary'}>
                    {formData.allowTaskMode ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Skill Mode:</span>
                  <Badge variant={formData.allowSkillMode ? 'default' : 'secondary'}>
                    {formData.allowSkillMode ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">Important</p>
                  <p className="text-sm text-amber-700">
                    Publishing this agent will make it accessible via the external API.
                    Anyone with a valid API key can invoke this agent.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="acknowledge"
                checked={acknowledged}
                onCheckedChange={(checked) => setAcknowledged(checked === true)}
              />
              <label htmlFor="acknowledge" className="text-sm leading-relaxed cursor-pointer">
                I have reviewed the security report and understand that this agent will be
                publicly accessible via API.
              </label>
            </div>
          </div>
        );

      case 'credentials':
        return (
          <div className="space-y-6">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-800">Agent Published!</p>
                  <p className="text-sm text-green-700">
                    Your agent is now available at the external API endpoint.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex gap-2">
                <Input
                  value={apiKey || ''}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyApiKey}
                  title="Copy API key"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Store this key securely. It will not be shown again.
              </p>
            </div>

            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p className="text-sm font-medium">Example Usage</p>
              <pre className="text-xs bg-background p-3 rounded overflow-x-auto">
{`curl -X POST \\
  https://yourapp.com/api/v1/published/${formData.slug}/task \\
  -H "X-API-Key: ${apiKey?.substring(0, 20)}..." \\
  -H "Content-Type: application/json" \\
  -d '{"task": "Your task here"}'`}
              </pre>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
              <Globe className="w-5 h-5 text-primary" />
            </div>
            <div>
              <SheetTitle>Publish Agent</SheetTitle>
              <SheetDescription>
                Make "{agentName}" available via external API
              </SheetDescription>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>
                Step {getCurrentStepIndex() + 1} of {STEPS.length}
              </span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Steps indicator */}
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const isActive = step.key === currentStep;
              const isCompleted = getCurrentStepIndex() > index;

              return (
                <div key={step.key} className="flex flex-col items-center space-y-2">
                  <div
                    className={`
                    flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors
                    ${
                      isActive
                        ? 'border-primary bg-primary text-primary-foreground'
                        : isCompleted
                        ? 'border-green-500 bg-green-500 text-white'
                        : 'border-muted-foreground/30 bg-background text-muted-foreground'
                    }
                  `}
                  >
                    {isCompleted ? <Check className="w-4 h-4" /> : step.icon}
                  </div>
                  <div className="text-center">
                    <div
                      className={`text-xs font-medium ${
                        isActive ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {step.title}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SheetHeader>

        <div className="flex flex-col h-full">
          <div className="flex-1 py-6">{renderStepContent()}</div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              {getCurrentStepIndex() > 0 && currentStep !== 'credentials' && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={isPending}
                  className="flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {currentStep === 'credentials' ? (
                <Button onClick={() => { handleClose(); onSuccess?.(); }}>
                  Done
                </Button>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
                    Cancel
                  </Button>

                  <Button
                    onClick={handleNext}
                    disabled={!canProceed() || isPending}
                    className="flex items-center gap-2"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {currentStep === 'configure' ? 'Scanning...' : 'Publishing...'}
                      </>
                    ) : currentStep === 'approve' ? (
                      <>
                        <Globe className="w-4 h-4" />
                        Publish
                      </>
                    ) : (
                      <>
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
