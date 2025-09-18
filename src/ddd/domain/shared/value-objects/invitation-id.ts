// AIDEV-NOTE: Value object for invitation identity
import { BaseId } from './base-id';

export class InvitationId extends BaseId<'InvitationId'> {
  constructor(value: number) {
    super(value, 'InvitationId');
  }

  static fromNumber(value: number): InvitationId {
    return new InvitationId(value);
  }

}