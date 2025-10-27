'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import type { SkillDTO } from '@/app/mappers/skill-mapper';
import { deleteSkill } from '@/app/actions/skills';
import { toast } from 'sonner';

interface SkillsListViewProps {
  agent: AgentDTO;
  initialSkills: SkillDTO[];
}

export function SkillsListView({
  agent,
  initialSkills
}: SkillsListViewProps) {
  const router = useRouter();
  const [skills, setSkills] = useState(initialSkills);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (skillId: number) => {
    if (!confirm('Are you sure you want to delete this skill? This action cannot be undone.')) {
      return;
    }

    setDeletingId(skillId);

    try {
      const result = await deleteSkill(skillId);

      if (result.success) {
        setSkills(skills.filter(s => s.id !== skillId));
        toast.success('Skill deleted successfully');
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/agents')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Agents
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Skills</h1>
            <p className="text-muted-foreground mt-1">
              Agent: {agent.name}
            </p>
          </div>
        </div>
        <Button
          onClick={() => router.push(`/agents/${agent.id}/skills/new`)}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Skill
        </Button>
      </div>

      {/* Skills Grid */}
      {skills.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-full bg-muted p-4">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">No skills yet</h3>
              <p className="text-muted-foreground mt-1">
                Create your first skill to get started
              </p>
            </div>
            <Button
              onClick={() => router.push(`/agents/${agent.id}/skills/new`)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Skill
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {skills.map(skill => (
            <Card
              key={skill.id}
              className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => router.push(`/agents/${agent.id}/skills/${skill.id}`)}
            >
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg line-clamp-1">
                    {skill.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {skill.description || 'No description'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
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
                      router.push(`/agents/${agent.id}/skills/${skill.id}`);
                    }}
                  >
                    <Edit className="h-3 w-3 mr-2" />
                    Edit
                  </Button>
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
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
