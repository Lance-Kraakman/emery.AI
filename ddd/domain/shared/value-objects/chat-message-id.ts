// AIDEV-NOTE: Identity Value Object for chat message identity (string-based UUID)
import { BaseStringId } from './base-string-id';

export class ChatMessageId extends BaseStringId<'ChatMessageId'> {
  constructor(value: string) {
    super(value, 'ChatMessageId');
  }

  static fromString(value: string): ChatMessageId {
    return new ChatMessageId(value);
  }
}