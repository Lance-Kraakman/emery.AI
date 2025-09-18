// AIDEV-NOTE: Identity Value Object for chat identity (string-based UUID)
import { BaseStringId } from './base-string-id';

export class ChatId extends BaseStringId<'ChatId'> {
  constructor(value: string) {
    super(value, 'ChatId');
  }

  static fromString(value: string): ChatId {
    return new ChatId(value);
  }
}