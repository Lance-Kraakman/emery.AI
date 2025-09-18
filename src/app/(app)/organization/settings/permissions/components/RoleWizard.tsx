'use client'

import React, { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/src/components/ui/sheet";
import { Badge } from "@/src/components/ui/badge";
import { Progress } from "@/src/components/ui/progress";
import { ChevronLeft, ChevronRight, Check, Plus, Users, Settings, Shield } from "lucide-react";
import { createCustomRole } from "@/src/app/actions/roles";
import { CompactPermissionList } from "./CompactPermissionList";
import { getAvailablePermissions } from "@/src/app/actions/roles";
import type { PermissionAssignment } from "./PermissionSelector";

interface RoleWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type WizardStep = 'basic' | 'permissions' | 'review';

interface RoleFormData {
  name: string;
  description: string;
  selectedPermissions: PermissionAssignment[];
}

const STEPS: { key: WizardStep; title: string; description: string; icon: React.ReactNode }[] = [
  {
    key: 'basic',
    title: 'Basic Information',
    description: 'Role name and description',
    icon: <Users className="w-4 h-4" />
  },
  {
    key: 'permissions',
    title: 'Permissions',
    description: 'Select permissions and scope',
    icon: <Shield className="w-4 h-4" />
  },
  {
    key: 'review',
    title: 'Review',
    description: 'Review and create role',
    icon: <Check className="w-4 h-4" />
  }
];

export function RoleWizard({ open, onOpenChange, onSuccess }: RoleWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('basic');
  const [error, setError] = useState("");
  const [availablePermissions, setAvailablePermissions] = useState<any[]>([]);

  const form = useForm({
    defaultValues: {
      name: '',
      description: '',
      selectedPermissions: [] as PermissionAssignment[],
    },
    onSubmit: async ({ value }) => {
      try {
        setError('');

        const formData = new FormData();
        formData.append('name', value.name.trim());
        formData.append('description', value.description.trim());
        formData.append('permissionAssignments', JSON.stringify(value.selectedPermissions));

        const result = await createCustomRole(formData);

        if (result.success) {
          onSuccess();
          handleClose();
        } else {
          setError(result.error || 'Failed to create role');
        }
      } catch (error) {
        console.error('Error creating role:', error);
        setError('Failed to create role');
      }
    },
  });

  const handleClose = () => {
    form.reset();
    setCurrentStep('basic');
    setError('');
    onOpenChange(false);
  };

  React.useEffect(() => {
    if (open) {
      // Load permissions when wizard opens
      getAvailablePermissions().then((perms: any) => {
        setAvailablePermissions(perms || []);
      }).catch((err: any) => {
        console.error('Error loading permissions:', err);
        setAvailablePermissions([]);
      });
    }
  }, [open]);

  const getPermissionName = (permissionId: number): string => {
    const permission = availablePermissions.find(p => p.id === permissionId);
    return permission ? `${permission.resource}:${permission.action}` : `Permission ${permissionId}`;
  };

  const getCurrentStepIndex = () => STEPS.findIndex(step => step.key === currentStep);
  const progress = ((getCurrentStepIndex() + 1) / STEPS.length) * 100;

  const canProceedFromBasic = () => {
    const nameValue = form.getFieldValue('name') || '';
    return nameValue.trim().length > 0;
  };

  const canProceedFromPermissions = () => {
    const permissions = form.getFieldValue('selectedPermissions') || [];
    return permissions.length > 0;
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'basic':
        return canProceedFromBasic();
      case 'permissions':
        return canProceedFromPermissions();
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!canProceed()) return;

    const currentIndex = getCurrentStepIndex();
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1].key);
    }
  };

  const handleBack = () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].key);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'basic':
        return (
          <div className="space-y-6">
            <form.Field
              name="name"
              validators={{
                onChange: ({ value }) => !value.trim() ? 'Role name is required' : undefined,
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="role-name">Role Name *</Label>
                  <Input
                    id="role-name"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="e.g., Content Editor, Project Manager"
                    className="text-base"
                  />
                  {field.state.meta.errors.length > 0 && (
                    <div className="text-sm text-destructive">
                      {field.state.meta.errors[0]}
                    </div>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field name="description">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="role-description">Description</Label>
                  <Textarea
                    id="role-description"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Describe what this role is for and what responsibilities it has..."
                    rows={4}
                    className="text-base resize-none"
                  />
                </div>
              )}
            </form.Field>

            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-medium text-sm mb-2">💡 Role Naming Tips</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Use descriptive names like "Content Editor" or "Sales Manager"</li>
                <li>• Avoid generic names like "User" or "Role1"</li>
                <li>• Think about the job function or responsibility level</li>
              </ul>
            </div>
          </div>
        );

      case 'permissions':
        return (
          <form.Field
            name="selectedPermissions"
            validators={{
              onChange: ({ value }) => value.length === 0 ? 'Please select at least one permission' : undefined,
            }}
          >
            {(field) => (
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-medium">Select Permissions</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Choose which permissions this role should have. You can specify resource-specific scopes for each permission.
                  </p>
                </div>

                <CompactPermissionList
                  selectedPermissions={field.state.value}
                  onSelectionChange={(permissions) => field.handleChange(permissions)}
                />

                {field.state.meta.errors.length > 0 && (
                  <div className="text-sm text-destructive">
                    {field.state.meta.errors[0]}
                  </div>
                )}
              </div>
            )}
          </form.Field>
        );

      case 'review':
        const formData = form.state.values;
        const permissionCount = formData.selectedPermissions.length;
        const resourceSpecificCount = formData.selectedPermissions.filter(p => p.resourceScope !== 'all').length;

        return (
          <div className="space-y-6">
            <div>
              <Label className="text-base font-medium">Role Summary</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Review the role details before creating.
              </p>
            </div>

            {/* Basic Info Summary */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Basic Information</span>
              </div>
              <div className="grid grid-cols-1 gap-3 pl-6">
                <div>
                  <span className="text-sm font-medium">Name:</span>
                  <span className="ml-2 text-sm">{formData.name}</span>
                </div>
                {formData.description && (
                  <div>
                    <span className="text-sm font-medium">Description:</span>
                    <span className="ml-2 text-sm text-muted-foreground">{formData.description}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Permissions Summary */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Permissions</span>
                </div>
                <Badge variant="outline">
                  {permissionCount} permission{permissionCount !== 1 ? 's' : ''}
                </Badge>
              </div>

              <div className="space-y-2 pl-6">
                {formData.selectedPermissions.map((assignment, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span>{getPermissionName(assignment.permissionId)}</span>
                    <Badge variant="secondary" className="text-xs">
                      {assignment.resourceScope}
                    </Badge>
                  </div>
                ))}
              </div>

              {resourceSpecificCount > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-3">
                  <p className="text-sm text-blue-800">
                    <strong>{resourceSpecificCount}</strong> permission{resourceSpecificCount !== 1 ? 's' : ''} have
                    resource-specific scoping applied.
                  </p>
                </div>
              )}
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
              <Plus className="w-5 h-5 text-primary" />
            </div>
            <div>
              <SheetTitle>Create Role</SheetTitle>
              <SheetDescription>
                Create a new role with specific permissions for your organization.
              </SheetDescription>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Step {getCurrentStepIndex() + 1} of {STEPS.length}</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Steps indicator */}
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const isActive = step.key === currentStep;
              const isCompleted = getCurrentStepIndex() > index;
              const isPending = getCurrentStepIndex() < index;

              return (
                <div key={step.key} className="flex flex-col items-center space-y-2">
                  <div className={`
                    flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors
                    ${isActive ? 'border-primary bg-primary text-primary-foreground' :
                      isCompleted ? 'border-green-500 bg-green-500 text-white' :
                      'border-muted-foreground/30 bg-background text-muted-foreground'}
                  `}>
                    {isCompleted ? <Check className="w-4 h-4" /> : step.icon}
                  </div>
                  <div className="text-center">
                    <div className={`text-xs font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {step.title}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SheetHeader>

        <form onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (currentStep === 'review') {
            form.handleSubmit();
          } else {
            handleNext();
          }
        }} className="flex flex-col h-full">
          <div className="flex-1 py-6">
            {renderStepContent()}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              {getCurrentStepIndex() > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={form.state.isSubmitting}
                  className="flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={form.state.isSubmitting}
              >
                Cancel
              </Button>

              {currentStep === 'review' ? (
                <Button
                  type="submit"
                  disabled={form.state.isSubmitting || !canProceed()}
                  className="flex items-center gap-2"
                >
                  {form.state.isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create Role
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={!canProceed()}
                  className="flex items-center gap-2"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}