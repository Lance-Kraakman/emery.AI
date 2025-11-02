'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Wrench, ChevronRight, Plus } from 'lucide-react';
import type { SkillDTO } from '@/app/mappers/skill-mapper';

interface CompactSkillsListProps {
  agentId: number;
  skills: SkillDTO[];
  className?: string;
}

export function CompactSkillsList({ agentId, skills, className = '' }: CompactSkillsListProps) {
  const router = useRouter();

  const handleSkillClick = (skillId: number) => {
    router.push(`/agents/${agentId}/skills/${skillId}`);
  };

  const handleAddSkill = () => {
    router.push(`/agents/${agentId}/skills/new`);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Skills</h4>
          <span className="text-xs text-muted-foreground">({skills.length})</span>
        </div>
        <button
          onClick={handleAddSkill}
          className="p-1 hover:bg-accent rounded transition-colors"
          title="Add new skill"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {skills.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-4 border rounded-md bg-muted/20">
          No skills yet
        </div>
      ) : (
        <div className="space-y-1">
          {skills.map((skill) => (
            <button
              key={skill.id}
              onClick={() => handleSkillClick(skill.id)}
              className="w-full flex items-center justify-between p-2 hover:bg-accent rounded-md transition-colors group text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{skill.name}</p>
                {skill.description && (
                  <p className="text-xs text-muted-foreground truncate">
                    {skill.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {skill.inputs.length} inputs
                  </span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">
                    {skill.outputs.length} outputs
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
