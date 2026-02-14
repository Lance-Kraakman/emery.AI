'use client';

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Mail,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Star,
  Clock,
  User,
  Users
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type {
  EmailThreadFieldValue,
  EmailMessage,
  EmailParticipant
} from '@/ddd/domain/tables/value-objects/field-values';

interface EmailThreadFieldProps {
  value: EmailThreadFieldValue | null | undefined;
  onChange?: (value: EmailThreadFieldValue | null) => void;
  isEditMode?: boolean;
  compact?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  focus?: boolean;
}

/**
 * Format a date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString(undefined, { weekday: 'short' });
  } else {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}

/**
 * Format participant for display
 */
function formatParticipant(participant: EmailParticipant): string {
  return participant.name || participant.email;
}

/**
 * Single email message component
 */
function EmailMessageItem({
  message,
  isExpanded,
  onToggle,
  isLast
}: {
  message: EmailMessage;
  isExpanded: boolean;
  onToggle: () => void;
  isLast: boolean;
}) {
  return (
    <div className={`${!isLast ? 'border-b' : ''}`}>
      {/* Message header - always visible */}
      <button
        onClick={onToggle}
        className="w-full text-left p-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-start gap-3">
          {/* Avatar placeholder */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-4 w-4 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            {/* From + Date row */}
            <div className="flex items-center justify-between gap-2">
              <span className={`font-medium text-sm truncate ${!message.isRead ? 'font-semibold' : ''}`}>
                {formatParticipant(message.from)}
              </span>
              <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                {message.isStarred && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                {message.attachments && message.attachments.length > 0 && (
                  <Paperclip className="h-3 w-3" />
                )}
                <span>{formatDate(message.date)}</span>
                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </div>
            </div>

            {/* Preview when collapsed */}
            {!isExpanded && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {message.body.replace(/<[^>]*>/g, '').substring(0, 100)}
              </p>
            )}
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 pl-14">
          {/* To/CC line */}
          <div className="text-xs text-muted-foreground mb-2">
            <span>To: {message.to.map(formatParticipant).join(', ')}</span>
            {message.cc && message.cc.length > 0 && (
              <span className="ml-2">Cc: {message.cc.map(formatParticipant).join(', ')}</span>
            )}
          </div>

          {/* Message body */}
          <div className="text-sm whitespace-pre-wrap">
            {message.bodyType === 'html' ? (
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: message.body }}
              />
            ) : (
              <p>{message.body}</p>
            )}
          </div>

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-3 pt-2 border-t">
              <div className="flex flex-wrap gap-2">
                {message.attachments.map((att) => (
                  <Badge key={att.id} variant="outline" className="text-xs">
                    <Paperclip className="h-3 w-3 mr-1" />
                    {att.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Full email thread viewer component
 */
function EmailThreadViewer({
  thread,
  maxHeight = '400px'
}: {
  thread: EmailThreadFieldValue;
  maxHeight?: string;
}) {
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(() => {
    // Default: expand the last message
    if (thread.messages.length > 0) {
      return new Set([thread.messages[thread.messages.length - 1].id]);
    }
    return new Set();
  });

  const toggleMessage = (messageId: string) => {
    setExpandedMessages(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedMessages(new Set(thread.messages.map(m => m.id)));
  };

  const collapseAll = () => {
    setExpandedMessages(new Set());
  };

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="p-3 border-b bg-muted/30">
        <h3 className="font-semibold text-sm truncate">{thread.subject}</h3>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          <span>{thread.participants.length} participants</span>
          <span>·</span>
          <span>{thread.messages.length} messages</span>
          {thread.unreadCount && thread.unreadCount > 0 && (
            <>
              <span>·</span>
              <Badge variant="secondary" className="text-[10px] px-1 py-0">
                {thread.unreadCount} unread
              </Badge>
            </>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <Button
          variant="ghost"
          size="sm"
          onClick={expandAll}
          className="h-6 text-xs"
        >
          Expand all
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={collapseAll}
          className="h-6 text-xs"
        >
          Collapse all
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea style={{ maxHeight }} className="flex-1">
        <div>
          {thread.messages.map((message, index) => (
            <EmailMessageItem
              key={message.id}
              message={message}
              isExpanded={expandedMessages.has(message.id)}
              onToggle={() => toggleMessage(message.id)}
              isLast={index === thread.messages.length - 1}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

/**
 * EmailThreadField - Component for email-thread field type
 *
 * Display Mode (isEditMode=false):
 * - Shows email thread as a compact badge with subject and message count
 * - Click badge to view full thread in popover/dialog
 *
 * Edit Mode + Compact (isEditMode=true, compact=true):
 * - Shows badge trigger in grid cell
 * - Click opens popover with thread viewer
 *
 * Edit Mode + Non-Compact (isEditMode=true, compact=false):
 * - Shows inline thread viewer (for forms)
 */
export function EmailThreadField({
  value,
  onChange,
  isEditMode = false,
  compact = false,
  disabled = false,
  readOnly = false,
  focus = false,
}: EmailThreadFieldProps) {
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // Get preview text for compact display
  const getPreviewText = useMemo((): string => {
    if (!value) return 'No thread';
    if (!value.messages || value.messages.length === 0) return 'Empty thread';

    const count = value.messages.length;
    const subject = value.subject || 'No subject';

    if (compact) {
      // Very compact: just count
      return `${count} msg${count !== 1 ? 's' : ''}`;
    }

    // Truncated subject + count
    const truncatedSubject = subject.length > 30 ? subject.substring(0, 27) + '...' : subject;
    return `${truncatedSubject} (${count})`;
  }, [value, compact]);

  // Empty state
  if (!value && !isEditMode) {
    return (
      <div className={compact ? 'text-xs' : 'text-sm'}>
        <span className="text-muted-foreground">—</span>
      </div>
    );
  }

  // If no value in edit mode, show placeholder
  if (!value) {
    return (
      <Badge
        variant="outline"
        className={`${compact ? 'text-[10px] px-1.5 py-0' : 'text-xs'} font-normal text-muted-foreground cursor-default`}
      >
        <Mail className={`${compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} mr-1`} />
        No thread
      </Badge>
    );
  }

  // Compact mode - use popover
  if (compact) {
    return (
      <Popover open={isViewerOpen} onOpenChange={setIsViewerOpen}>
        <PopoverTrigger asChild>
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 cursor-pointer hover:bg-accent ${
              value.unreadCount && value.unreadCount > 0 ? 'font-semibold' : ''
            }`}
          >
            <Mail className="h-2.5 w-2.5 mr-1" />
            {getPreviewText}
            {value.unreadCount && value.unreadCount > 0 && (
              <span className="ml-1 bg-primary text-primary-foreground rounded-full px-1 text-[8px]">
                {value.unreadCount}
              </span>
            )}
          </Badge>
        </PopoverTrigger>
        <PopoverContent className="w-[500px] p-0" align="start" side="bottom">
          <EmailThreadViewer thread={value} maxHeight="350px" />
        </PopoverContent>
      </Popover>
    );
  }

  // Non-compact mode - use dialog for full view or inline
  return (
    <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
      <div className="space-y-2">
        {/* Thread preview card */}
        <div className="border rounded-lg p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate">{value.subject || 'No subject'}</h4>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span>{value.messages.length} message{value.messages.length !== 1 ? 's' : ''}</span>
                {value.lastMessageAt && (
                  <>
                    <span>·</span>
                    <Clock className="h-3 w-3" />
                    <span>{formatDate(value.lastMessageAt)}</span>
                  </>
                )}
              </div>
              {value.snippet && (
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {value.snippet}
                </p>
              )}
            </div>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-shrink-0">
                View Thread
              </Button>
            </DialogTrigger>
          </div>
        </div>
      </div>

      <DialogContent className="max-w-2xl max-h-[80vh] p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{value.subject}</DialogTitle>
        </DialogHeader>
        <EmailThreadViewer thread={value} maxHeight="70vh" />
      </DialogContent>
    </Dialog>
  );
}

// Export the viewer component for use in other contexts
export { EmailThreadViewer };
