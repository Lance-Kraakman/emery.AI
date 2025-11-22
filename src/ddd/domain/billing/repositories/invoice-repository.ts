/**
 * Invoice Repository Interface
 *
 * Domain repository interface for invoice management and billing history.
 */
import type { Invoice, CreateInvoiceData, InvoiceStatus } from '../entities/invoice';
import type { InvoiceId } from '../value-objects/invoice-id';
import type { OrganizationId } from '@/ddd/domain/shared/value-objects';

export interface InvoiceQueryFilters {
  organizationId?: OrganizationId;
  stripeInvoiceId?: string;
  stripeSubscriptionId?: string;
  status?: InvoiceStatus;
  periodStartAfter?: Date;
  periodStartBefore?: Date;
  periodEndAfter?: Date;
  periodEndBefore?: Date;
  limit?: number;
  offset?: number;
}

export interface InvoiceSummary {
  totalInvoices: number;
  totalAmountUsd: number;
  totalCreditsUsed: number;
  totalOverageCreditsUsed: number;
  totalOverageAmountUsd: number;
  paidInvoices: number;
  unpaidInvoices: number;
}

export interface IInvoiceRepository {
  /**
   * Create a new invoice record
   */
  create(data: CreateInvoiceData): Promise<Invoice>;

  /**
   * Find invoice by ID
   */
  findById(id: InvoiceId): Promise<Invoice | null>;

  /**
   * Find invoice by Stripe invoice ID
   */
  findByStripeInvoiceId(stripeInvoiceId: string): Promise<Invoice | null>;

  /**
   * Find invoices with filters
   */
  find(filters: InvoiceQueryFilters): Promise<Invoice[]>;

  /**
   * Get all invoices for an organization
   */
  findByOrganizationId(
    organizationId: OrganizationId,
    limit?: number,
    offset?: number
  ): Promise<Invoice[]>;

  /**
   * Get invoices for a specific billing period
   */
  findByPeriod(
    organizationId: OrganizationId,
    startDate: Date,
    endDate: Date
  ): Promise<Invoice[]>;

  /**
   * Get invoice summary/statistics for an organization
   */
  getOrganizationSummary(
    organizationId: OrganizationId,
    startDate?: Date,
    endDate?: Date
  ): Promise<InvoiceSummary>;

  /**
   * Update invoice status
   */
  updateStatus(
    id: InvoiceId,
    status: InvoiceStatus,
    paidAt?: Date
  ): Promise<Invoice>;

  /**
   * Update invoice with payment information
   */
  update(
    id: InvoiceId,
    updates: Partial<CreateInvoiceData>
  ): Promise<Invoice>;

  /**
   * Get most recent invoice for organization
   */
  findLatestByOrganizationId(organizationId: OrganizationId): Promise<Invoice | null>;

  /**
   * Check if invoice exists by Stripe ID (for idempotency)
   */
  existsByStripeInvoiceId(stripeInvoiceId: string): Promise<boolean>;
}
