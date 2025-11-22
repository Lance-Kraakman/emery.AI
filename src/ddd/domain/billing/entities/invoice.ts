/**
 * Invoice Entity
 *
 * Domain entity representing monthly billing invoices for organizations.
 * Tracks subscription fees and pay-as-you-go overage charges.
 */
import { InvoiceId } from '../value-objects/invoice-id';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

export interface InvoiceMetadata {
  tier?: string;
  paymentMethod?: string;
  failureReason?: string;
  notes?: string;
  [key: string]: any;
}

export interface CreateInvoiceData {
  organizationId: OrganizationId;
  stripeInvoiceId?: string;
  stripeSubscriptionId?: string;
  periodStart: Date;
  periodEnd: Date;
  includedCreditsUsed?: number;
  overageCreditsUsed?: number;
  totalCreditsUsed?: number;
  subscriptionAmountUsd?: number;
  overageAmountUsd?: number;
  totalAmountUsd: number;
  status?: InvoiceStatus;
  invoicedAt?: Date;
  paidAt?: Date;
  metadata?: InvoiceMetadata;
}

export interface Invoice {
  id: InvoiceId;
  organizationId: OrganizationId;
  stripeInvoiceId?: string;
  stripeSubscriptionId?: string;
  periodStart: Date;
  periodEnd: Date;
  includedCreditsUsed: number;
  overageCreditsUsed: number;
  totalCreditsUsed: number;
  subscriptionAmountUsd: number;
  overageAmountUsd: number;
  totalAmountUsd: number;
  status: InvoiceStatus;
  invoicedAt?: Date;
  paidAt?: Date;
  createdAt: Date;
  metadata?: InvoiceMetadata;
}

/**
 * Invoice Domain Utilities
 */
export class InvoiceUtils {
  /**
   * Validate invoice data
   */
  static validateInvoiceData(data: CreateInvoiceData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (data.periodStart >= data.periodEnd) {
      errors.push('Period end must be after period start');
    }

    if (data.totalAmountUsd < 0) {
      errors.push('Total amount must be non-negative');
    }

    if (data.subscriptionAmountUsd !== undefined && data.subscriptionAmountUsd < 0) {
      errors.push('Subscription amount must be non-negative');
    }

    if (data.overageAmountUsd !== undefined && data.overageAmountUsd < 0) {
      errors.push('Overage amount must be non-negative');
    }

    if (data.includedCreditsUsed !== undefined && data.includedCreditsUsed < 0) {
      errors.push('Included credits used must be non-negative');
    }

    if (data.overageCreditsUsed !== undefined && data.overageCreditsUsed < 0) {
      errors.push('Overage credits used must be non-negative');
    }

    if (data.totalCreditsUsed !== undefined && data.totalCreditsUsed < 0) {
      errors.push('Total credits used must be non-negative');
    }

    // Validate credit breakdown consistency
    const includedCredits = data.includedCreditsUsed || 0;
    const overageCredits = data.overageCreditsUsed || 0;
    const totalCredits = data.totalCreditsUsed || 0;

    if (totalCredits !== includedCredits + overageCredits) {
      errors.push('Total credits must equal included + overage credits');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calculate overage amount from credits
   */
  static calculateOverageAmount(overageCredits: number, pricePerCredit: number): number {
    return overageCredits * pricePerCredit;
  }

  /**
   * Check if invoice is finalized (not draft)
   */
  static isFinalized(invoice: Invoice): boolean {
    return invoice.status !== 'draft';
  }

  /**
   * Check if invoice is paid
   */
  static isPaid(invoice: Invoice): boolean {
    return invoice.status === 'paid';
  }

  /**
   * Check if invoice has overage charges
   */
  static hasOverage(invoice: Invoice): boolean {
    return invoice.overageCreditsUsed > 0;
  }
}
