'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit, Trash2, Globe, Copy, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SkillDTO } from '@/app/mappers/skill-mapper';
import { deleteSkill } from '@/app/actions/skills';
import { toast } from 'sonner';

interface OrganizationSkillsListViewProps {
  organizationId: number;
  initialSkills: SkillDTO[];
}

type SkillView = 'organization' | 'agent' | 'all';

export function OrganizationSkillsListView({
  organizationId,
  initialSkills
}: OrganizationSkillsListViewProps) {
  const router = useRouter();
  const [skills, setSkills] = useState(initialSkills);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [view, setView] = useState<SkillView>('organization');

  // Filter skills based on current view
  const filteredSkills = useMemo(() => {
    if (view === 'organization') {
      return skills.filter(skill => skill.agentId === null);
    } else if (view === 'agent') {
      return skills.filter(skill => skill.agentId !== null);
    }
    return skills; // 'all'
  }, [skills, view]);

  const handleDelete = async (skillId: number) => {
    if (!confirm('Are you sure you want to delete this organization skill? This action cannot be undone.')) {
      return;
    }

    setDeletingId(skillId);

    try {
      const result = await deleteSkill(skillId);

      if (result.success) {
        setSkills(skills.filter(s => s.id !== skillId));
        toast.success('Organization skill deleted successfully');
      } else {
        toast.error(result.error || 'Failed to delete skill');
      }
    } catch (error) {
      console.error('Error deleting skill:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setDeletingId(null);
    }
  };

  const renderSkillCard = (skill: SkillDTO) => {
    const isOrgSkill = skill.agentId === null;

    return (
      <Card
        key={skill.id}
        className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
        onClick={() => {
          if (isOrgSkill) {
            router.push(`/skills/${skill.id}`);
          } else {
            router.push(`/agents/${skill.agentId}/skills/${skill.id}`);
          }
        }}
      >
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-lg line-clamp-1">
                {skill.name}
              </h3>
              <Badge variant={isOrgSkill ? "secondary" : "outline"} className="ml-auto">
                {isOrgSkill ? (
                  <>
                    <Globe className="h-3 w-3 mr-1" />
                    Organization
                  </>
                ) : (
                  <>
                    <Bot className="h-3 w-3 mr-1" />
                    Agent
                  </>
                )}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {skill.description || 'No description'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {skill.inputs.length > 0 && (
              <Badge variant="outline">
                {skill.inputs.length} {skill.inputs.length === 1 ? 'input' : 'inputs'}
              </Badge>
            )}
            {skill.outputs.length > 0 && (
              <Badge variant="outline">
                {skill.outputs.length} {skill.outputs.length === 1 ? 'output' : 'outputs'}
              </Badge>
            )}
            {skill.tools.length > 0 && (
              <Badge variant="secondary">
                {skill.tools.length} {skill.tools.length === 1 ? 'tool' : 'tools'}
              </Badge>
            )}
          </div>

          <div className="flex gap-2 pt-2" onClick={e => e.stopPropagation()}>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                if (isOrgSkill) {
                  router.push(`/skills/${skill.id}`);
                } else {
                  router.push(`/agents/${skill.agentId}/skills/${skill.id}`);
                }
              }}
            >
              <Edit className="h-3 w-3 mr-2" />
              {isOrgSkill ? 'Edit' : 'View'}
            </Button>
            {isOrgSkill && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/skills/new?templateId=${skill.id}`);
                }}
                title="Use as template"
              >
                <Copy className="h-3 w-3 mr-2" />
                Clone
              </Button>
            )}
            {isOrgSkill && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(skill.id);
                }}
                disabled={deletingId === skill.id}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="h-8 w-8" />
            <h1 className="text-3xl font-bold">Skills</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Browse organization templates and agent skills
          </p>
        </div>
        <Button
          onClick={() => router.push('/skills/new')}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Organization Skill
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={view} onValueChange={(v) => setView(v as SkillView)}>
        <TabsList>
          <TabsTrigger value="organization">
            <Globe className="h-4 w-4 mr-2" />
            Organization ({skills.filter(s => s.agentId === null).length})
          </TabsTrigger>
          <TabsTrigger value="agent">
            <Bot className="h-4 w-4 mr-2" />
            Agent ({skills.filter(s => s.agentId !== null).length})
          </TabsTrigger>
          <TabsTrigger value="all">
            All ({skills.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={view} className="mt-6">
          {/* Skills Grid */}
          {filteredSkills.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="rounded-full bg-muted p-4">
                  {view === 'organization' ? (
                    <Globe className="h-8 w-8 text-muted-foreground" />
                  ) : (
                    <Bot className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">
                    {view === 'organization' && 'No organization skills yet'}
                    {view === 'agent' && 'No agent skills yet'}
                    {view === 'all' && 'No skills yet'}
                  </h3>
                  <p className="text-muted-foreground mt-1">
                    {view === 'organization' && 'Create reusable skill templates that can be cloned and customized'}
                    {view === 'agent' && 'Agent skills will appear here once created from organization templates'}
                    {view === 'all' && 'Create your first organization skill to get started'}
                  </p>
                </div>
                {view === 'organization' && (
                  <Button onClick={() => router.push('/skills/new')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Organization Skill
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredSkills.map(renderSkillCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
