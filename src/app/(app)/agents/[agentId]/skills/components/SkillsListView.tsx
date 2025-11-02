'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Wrench, Plus, ArrowLeft, ChevronRight } from 'lucide-react';
import type { AgentDTO } from '@/app/dtos/agent.dto';
import type { SkillDTO } from '@/app/mappers/skill-mapper';

interface SkillsListViewProps {
  agent: AgentDTO;
  skills: SkillDTO[];
}

export function SkillsListView({ agent, skills }: SkillsListViewProps) {
  const router = useRouter();

  const handleBack = () => {
    router.push(`/agents/${agent.id}`);
  };

  const handleAddSkill = () => {
    router.push(`/agents/${agent.id}/skills/new`);
  };

  const handleSkillClick = (skillId: number) => {
    router.push(`/agents/${agent.id}/skills/${skillId}`);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {agent.name}
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wrench className="h-6 w-6" />
              Skills for {agent.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage multi-step workflows and tasks for this agent
            </p>
          </div>
          <button
            onClick={handleAddSkill}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Skill
          </button>
        </div>
      </div>

      {/* Skills List */}
      {skills.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/20">
          <Wrench className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">No skills yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first skill to add multi-step workflows to this agent
          </p>
          <button
            onClick={handleAddSkill}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Skill
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {skills.map((skill) => (
            <button
              key={skill.id}
              onClick={() => handleSkillClick(skill.id)}
              className="w-full text-left p-4 border rounded-lg bg-card hover:bg-accent transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                    {skill.name}
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </h3>
                  {skill.description && (
                    <p className="text-sm text-muted-foreground mb-3">
                      {skill.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{skill.inputs.length} inputs</span>
                    <span>•</span>
                    <span>{skill.outputs.length} outputs</span>
                    {skill.tools && skill.tools.length > 0 && (
                      <>
                        <span>•</span>
                        <span>{skill.tools.length} tools</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
