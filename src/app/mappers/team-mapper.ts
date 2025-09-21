import { Team } from '@/ddd/domain/teams/entities/team';

export interface TeamDTO {
  id: number;
  name: string;
  purpose: string | null;
  description: string | null;
  responsibilities: string[] | null;
  goals: string[] | null;
  agentIds: string[] | null;
  databaseId: string | null;
  organizationId: number;
  createdAt?: Date | null;
}

export class TeamMapper {
  static toDTO(team: Team): TeamDTO {
    return {
      id: team.id.value,
      name: team.name,
      purpose: team.purpose,
      description: team.description,
      responsibilities: team.responsibilities,
      goals: team.goals,
      agentIds: team.agentIds ? team.agentIds.map(agentId => agentId.value.toString()) : null,
      databaseId: team.databaseId,
      organizationId: team.organizationId.value,
      createdAt: team.createdAt
    };
  }
}