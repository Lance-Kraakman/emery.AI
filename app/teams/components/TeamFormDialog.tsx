'use client';

import { useState } from 'react';
import { Agent, Team } from '@/types/db';
import { createTeamAction, updateTeam } from '@/app/actions/teams';
import { useEmeryData } from '@/hooks/useEmeryData';

interface TeamFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  team?: Team | null;
  agents: Agent[];
}

export default function TeamFormDialog({ isOpen, onClose, team, agents }: TeamFormDialogProps) {
  const { currentOrganization } = useEmeryData();
  const [loading, setLoading] = useState(false);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>(team?.agentIds || []);

  if (!isOpen) return null;

  const handleSubmit = async (formData: FormData) => {
    if (!currentOrganization) return;
    
    setLoading(true);
    try {
      // Add organization ID and agent IDs to form data
      formData.append('organizationId', currentOrganization.id.toString());
      formData.append('agentIds', selectedAgentIds.join(','));

      if (team) {
        // Update existing team
        const data = {
          name: formData.get('name') as string,
          purpose: formData.get('purpose') as string,
          description: formData.get('description') as string,
          responsibilities: (formData.get('responsibilities') as string)?.split(',').map(r => r.trim()).filter(r => r),
          goals: (formData.get('goals') as string)?.split(',').map(g => g.trim()).filter(g => g),
          agentIds: selectedAgentIds,
        };
        
        await updateTeam(team.id, data);
      } else {
        // Create new team
        await createTeamAction(formData);
      }
      
      onClose();
    } catch (error) {
      console.error('Error saving team:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAgentSelection = (agentId: string) => {
    setSelectedAgentIds(prev => 
      prev.includes(agentId) 
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-popover p-6 rounded-lg shadow-lg w-full max-w-2xl border max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4 text-foreground">{team ? 'Edit Team' : 'Create New Team'}</h2>
        <form action={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-muted-foreground">Name</label>
              <input
                id="name"
                name="name"
                type="text"
                required
                defaultValue={team?.name}
                className="mt-1 block w-full p-2 border rounded"
                placeholder="e.g., Sales Team"
              />
            </div>
            <div>
              <label htmlFor="purpose" className="block text-sm font-medium text-muted-foreground">Purpose</label>
              <input
                id="purpose"
                name="purpose"
                type="text"
                defaultValue={team?.purpose ?? ''}
                className="mt-1 block w-full p-2 border rounded"
                placeholder="e.g., Drive revenue growth"
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-muted-foreground">Description</label>
              <textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={team?.description ?? ''}
                className="mt-1 block w-full p-2 border rounded"
                placeholder="Provide a detailed description of the team..."
              />
            </div>
            <div>
              <label htmlFor="responsibilities" className="block text-sm font-medium text-muted-foreground">Responsibilities</label>
              <textarea
                id="responsibilities"
                name="responsibilities"
                rows={2}
                defaultValue={team?.responsibilities?.join(', ') ?? ''}
                className="mt-1 block w-full p-2 border rounded"
                placeholder="e.g., Lead generation, Customer outreach, Sales reporting (comma-separated)"
              />
              <p className="text-xs text-muted-foreground mt-1">Separate multiple responsibilities with commas</p>
            </div>
            <div>
              <label htmlFor="goals" className="block text-sm font-medium text-muted-foreground">Goals</label>
              <textarea
                id="goals"
                name="goals"
                rows={2}
                defaultValue={team?.goals?.join(', ') ?? ''}
                className="mt-1 block w-full p-2 border rounded"
                placeholder="e.g., Increase revenue by 20%, Improve customer satisfaction (comma-separated)"
              />
              <p className="text-xs text-muted-foreground mt-1">Separate multiple goals with commas</p>
            </div>
            
            {/* Agent Selection */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Team Agents</label>
              <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-2">
                {agents.length > 0 ? (
                  agents.map((agent) => (
                    <label key={agent.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedAgentIds.includes(agent.id.toString())}
                        onChange={() => toggleAgentSelection(agent.id.toString())}
                        className="rounded"
                      />
                      <span className="text-sm">
                        <span className="font-medium">{agent.name}</span>
                        <span className="text-muted-foreground"> - {agent.role}</span>
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No agents available</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Selected: {selectedAgentIds.length} agent{selectedAgentIds.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border rounded text-foreground hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? 'Saving...' : (team ? 'Update Team' : 'Create Team')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}