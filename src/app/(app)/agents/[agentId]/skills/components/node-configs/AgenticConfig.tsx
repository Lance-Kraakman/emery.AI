'use client';

import { useState, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UnifiedChatInput } from '@/components/shared/UnifiedChatInput';
import { uploadSkillAttachment, deleteSkillAttachment } from '@/app/actions/skills';
import type { ConfigWithVariables, AgenticNodeData } from './types';

interface AgenticConfigProps extends ConfigWithVariables<AgenticNodeData> {
  skillId?: number;
}

export function AgenticConfig({
  data,
  onUpdate,
  variables,
  skillId,
  disabled,
}: AgenticConfigProps) {
  // Track pending attachments (files being uploaded)
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Convert WorkflowVariable to the format expected by UnifiedChatInput
  const chatVariables = variables.map((v) => ({
    name: v.name,
    description: v.description || v.label || '',
  }));

  // Handle adding a new attachment - upload to S3 immediately
  const handleAttachmentAdd = useCallback(async (file: File) => {
    if (!skillId) {
      console.error('Cannot upload attachment: skillId is required');
      return;
    }

    // Add to pending while uploading
    setPendingAttachments((prev) => [...prev, file]);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', file.type.startsWith('image/') ? 'image' : 'file');

      const result = await uploadSkillAttachment(skillId, formData);

      if (result.success && result.data) {
        // Add to existing attachments
        const newAttachment = {
          url: result.data.url,
          filename: result.data.filename,
          type: result.data.type as 'image' | 'file',
          size: result.data.sizeBytes,
          s3Key: result.data.s3Key,
        };
        onUpdate({
          attachments: [...(data.attachments || []), newAttachment],
        });
      } else {
        console.error('Upload failed:', result.error);
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      // Remove from pending
      setPendingAttachments((prev) => prev.filter((f) => f !== file));
      setIsUploading(false);
    }
  }, [skillId, data.attachments, onUpdate]);

  // Handle removing a pending attachment (while uploading)
  const handleAttachmentRemove = useCallback((index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Handle removing an existing (already uploaded) attachment
  const handleExistingAttachmentRemove = useCallback(async (index: number) => {
    const attachment = data.attachments?.[index];
    if (!attachment || !skillId) return;

    // Remove from S3 if we have the s3Key
    if ((attachment as { s3Key?: string }).s3Key) {
      await deleteSkillAttachment(skillId, (attachment as { s3Key?: string }).s3Key!);
    }

    const newAttachments = [...(data.attachments || [])];
    newAttachments.splice(index, 1);
    onUpdate({ attachments: newAttachments });
  }, [data.attachments, skillId, onUpdate]);

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label htmlFor="instructions" className="text-xs">
          Instructions
        </Label>
        <UnifiedChatInput
          mode="form"
          minHeight="120px"
          value={data.instructions}
          onChange={(value) => onUpdate({ instructions: value })}
          variables={chatVariables}
          enableSendButton={false}
          enableAttachments={true}
          pendingAttachments={pendingAttachments}
          onAttachmentAdd={handleAttachmentAdd}
          onAttachmentRemove={handleAttachmentRemove}
          existingAttachments={data.attachments}
          onExistingAttachmentRemove={handleExistingAttachmentRemove}
          disabled={disabled}
          placeholder="Describe what this step should do... (@ for tools, { for variables)"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Agent Type</Label>
        <Select
          value={data.agentType || 'tool_calling'}
          onValueChange={(value) => onUpdate({ agentType: value })}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tool_calling">Tool Calling</SelectItem>
            <SelectItem value="code_agent">Code Agent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {data.tools && data.tools.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs">Tools ({data.tools.length})</Label>
          <div className="flex flex-wrap gap-1">
            {data.tools.map((tool, idx) => (
              <span
                key={idx}
                className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300"
              >
                {tool.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
