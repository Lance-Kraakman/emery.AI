'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { ConfigWithSkills, SkillRefNodeData } from './types';

export function SkillRefConfig({
  data,
  onUpdate,
  availableSkills,
  disabled,
}: ConfigWithSkills<SkillRefNodeData>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="skillId" className="text-xs">
        Select Skill
      </Label>
      <Select
        value={data.skillId?.toString() || ''}
        onValueChange={(value) => {
          const skill = availableSkills.find((s) => s.id.toString() === value);
          onUpdate({
            skillId: parseInt(value),
            skillName: skill?.name,
            skillType: skill?.executionType,
          });
        }}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Choose a skill..." />
        </SelectTrigger>
        <SelectContent>
          {availableSkills.map((skill) => (
            <SelectItem key={skill.id} value={skill.id.toString()}>
              <span className="flex items-center gap-2">
                {skill.name}
                {skill.executionType && (
                  <span className="text-[10px] text-muted-foreground">
                    ({skill.executionType})
                  </span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
