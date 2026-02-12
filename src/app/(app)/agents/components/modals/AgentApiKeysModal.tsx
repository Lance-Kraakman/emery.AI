'use client';

import React, { useState } from 'react';
import { Key, Copy, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BaseModal } from './BaseModal';
import type { AgentDTO } from '@/app/dtos/agent.dto';
import { regenerateAgentApiKey } from '@/app/actions/agents';

interface AgentApiKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: AgentDTO;
  onUpdate?: () => void;
}

export function AgentApiKeysModal({ isOpen, onClose, agent, onUpdate }: AgentApiKeysModalProps) {
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegenerate = async () => {
    setRegenerating(true);
    setError(null);
    try {
      const result = await regenerateAgentApiKey(agent.id);
      if (result.success && result.data) {
        setNewApiKey(result.data.apiKey);
        onUpdate?.();
      } else {
        setError(result.error || 'Failed to regenerate API key');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!newApiKey) return;
    await navigator.clipboard.writeText(newApiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setNewApiKey(null);
    setCopied(false);
    setError(null);
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title="API Keys"
      description="Manage API keys for webhook authentication and external integrations."
      size="md"
    >
      <div className="p-6 space-y-6">
        {/* Current key status */}
        <div className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30">
          <Key className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Agent API Key</p>
            <p className="text-sm text-muted-foreground mt-1">
              Generate a key for webhook authentication and external integrations.
            </p>
          </div>
        </div>

        {/* Newly generated key */}
        {newApiKey && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 rounded-lg border border-warning/50 bg-warning/5">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <p className="text-sm text-warning">
                Store this key securely. It will not be shown again.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={newApiKey}
                className="flex-1 px-3 py-2 text-xs font-mono bg-muted border rounded-md"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <CheckCircle className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Regenerate button */}
        <Button
          onClick={handleRegenerate}
          disabled={regenerating}
          variant="default"
          className="w-full"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${regenerating ? 'animate-spin' : ''}`} />
          Generate API Key
        </Button>

        <p className="text-xs text-muted-foreground">
          If a key already exists, the previous key will remain valid for 24 hours.
        </p>

        {/* Usage info */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-2">Usage</p>
          <p className="text-xs text-muted-foreground mb-2">
            Include the API key in the Authorization header when calling webhooks:
          </p>
          <pre className="text-xs font-mono bg-muted p-3 rounded-md overflow-x-auto">
            {`Authorization: Bearer <api_key>`}
          </pre>
        </div>
      </div>
    </BaseModal>
  );
}
