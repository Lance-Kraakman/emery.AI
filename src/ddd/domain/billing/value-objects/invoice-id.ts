/**
 * Invoice ID Value Object
 *
 * Type-safe identifier for Invoice entities
 */
import { BaseId } from '@/ddd/domain/shared/value-objects/base-id';

export class InvoiceId extends BaseId<'InvoiceId'> {
  static fromNumber(value: number): InvoiceId {
    return new InvoiceId(value, 'InvoiceId');
  }

  static create(): InvoiceId {
    // ID will be assigned by database
    return new InvoiceId(0, 'InvoiceId');
  }
}
